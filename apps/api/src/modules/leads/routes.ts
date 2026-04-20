import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../../lib/errors.js";
import { normalizeEmail, normalizePhone } from "../../lib/normalize.js";
import { recordAudit } from "../audit/service.js";
import { detectInternalDuplicates } from "./duplicate-detection.js";
import {
  CreateLeadSchema,
  ApproveLeadSchema,
  RejectLeadSchema,
  BulkApproveSchema,
  ResolveDuplicateSchema,
} from "@eventintake/shared";

async function getLeadAndAssertAccess(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { event: true },
  });
  if (!lead) throw new NotFoundError("Lead");

  const membership = await prisma.clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId: lead.event.clinicId, userId } },
  });
  if (!membership) throw new ForbiddenError();
  return lead;
}

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Submit a new lead (called from extension)
  app.post("/leads", async (req, reply) => {
    const body = CreateLeadSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    // Idempotency: return existing if key already used
    const existing = await prisma.lead.findUnique({
      where: { idempotencyKey: body.data.idempotencyKey },
    });
    if (existing) return reply.status(200).send(existing);

    // Validate event exists and user has access
    const event = await prisma.event.findUnique({ where: { id: body.data.eventId } });
    if (!event) throw new NotFoundError("Event");
    if (event.status !== "active") throw new ValidationError("Event is not active");

    const membership = await prisma.clinicMembership.findUnique({
      where: { clinicId_userId: { clinicId: event.clinicId, userId: req.user.sub } },
    });
    if (!membership) throw new ForbiddenError();

    // Validate form template version
    const templateVersion = await prisma.formTemplateVersion.findUnique({
      where: { id: body.data.formTemplateVersionId },
      include: { fields: true },
    });
    if (!templateVersion) throw new NotFoundError("FormTemplateVersion");
    if (!templateVersion.isPublished) throw new ValidationError("Form template version is not published");

    // Check required fields
    const requiredFields = templateVersion.fields.filter((f) => f.required);
    const submittedFieldIds = new Set(body.data.fieldValues.map((v) => v.formFieldId));
    const missingFields = requiredFields.filter((f) => !submittedFieldIds.has(f.id));
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.map((f) => f.label).join(", ")}`);
    }

    // Validate required consents
    const consentRequirements = await prisma.eventConsentRequirement.findMany({
      where: { eventId: event.id, required: true },
    });
    const submittedConsentVersionIds = new Set(body.data.consents.map((c) => c.consentTemplateVersionId));
    const missingConsents = consentRequirements.filter(
      (r) => !submittedConsentVersionIds.has(r.consentTemplateVersionId),
    );
    if (missingConsents.length > 0) {
      throw new ValidationError("Missing required consent records");
    }

    // Check that required consents were actually granted
    const ungranted = body.data.consents.filter((c) => {
      const req = consentRequirements.find((r) => r.consentTemplateVersionId === c.consentTemplateVersionId);
      return req?.required && !c.granted;
    });
    if (ungranted.length > 0) {
      throw new ValidationError("Required consents must be granted to submit");
    }

    // Normalize contact fields
    const normalizedEmail = body.data.email ? normalizeEmail(body.data.email) : undefined;
    const normalizedPhone = body.data.phone ? normalizePhone(body.data.phone) : undefined;

    // Create lead + field values + consents in a transaction
    const lead = await prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          idempotencyKey: body.data.idempotencyKey,
          eventId: body.data.eventId,
          formTemplateVersionId: body.data.formTemplateVersionId,
          firstName: body.data.firstName,
          lastName: body.data.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          dateOfBirth: body.data.dateOfBirth ? new Date(body.data.dateOfBirth) : undefined,
          source: body.data.source,
          createdBy: req.user.sub,
          status: "submitted",
        },
      });

      if (body.data.fieldValues.length > 0) {
        await tx.leadFieldValue.createMany({
          data: body.data.fieldValues.map((fv) => ({
            leadId: newLead.id,
            formFieldId: fv.formFieldId,
            value: fv.value,
          })),
        });
      }

      if (body.data.consents.length > 0) {
        await tx.leadConsent.createMany({
          data: body.data.consents.map((c) => ({
            leadId: newLead.id,
            consentTemplateVersionId: c.consentTemplateVersionId,
            granted: c.granted,
            capturedAt: new Date(c.capturedAt),
            capturedBy: req.user.sub,
            rawCheckboxValue: c.rawCheckboxValue,
          })),
        });
      }

      return newLead;
    });

    await recordAudit({ action: "lead_created", userId: req.user.sub, leadId: lead.id });

    // Run duplicate detection after creation
    const duplicateCount = await detectInternalDuplicates({
      leadId: lead.id,
      clinicId: event.clinicId,
      email: normalizedEmail,
      phone: normalizedPhone,
      firstName: body.data.firstName,
      lastName: body.data.lastName,
      dateOfBirth: body.data.dateOfBirth ? new Date(body.data.dateOfBirth) : null,
    });

    // Check for missing non-required consents that indicate needs_review
    const allRequirements = await prisma.eventConsentRequirement.findMany({
      where: { eventId: event.id },
    });
    const submittedIds = new Set(body.data.consents.map((c) => c.consentTemplateVersionId));
    const missingAny = allRequirements.some((r) => !submittedIds.has(r.consentTemplateVersionId));

    const finalStatus = duplicateCount > 0 || missingAny ? "needs_review" : "ready";
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: finalStatus },
    });

    return reply.status(201).send({ ...updatedLead, duplicateCandidateCount: duplicateCount });
  });

  // Get full lead detail
  app.get("/leads/:id", async (req) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        event: true,
        formTemplateVersion: { include: { fields: { orderBy: { displayOrder: "asc" } } } },
        fieldValues: { include: { formField: true } },
        consents: { include: { consentTemplateVersion: { include: { consentTemplate: true } } } },
        duplicates: true,
        syncJobs: { orderBy: { createdAt: "desc" } },
        ehrPatientRef: true,
        notes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) throw new NotFoundError("Lead");

    const membership = await prisma.clinicMembership.findUnique({
      where: { clinicId_userId: { clinicId: lead.event.clinicId, userId: req.user.sub } },
    });
    if (!membership) throw new ForbiddenError();

    return lead;
  });

  // List leads for an event
  app.get("/events/:eventId/leads", async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError("Event");

    const membership = await prisma.clinicMembership.findUnique({
      where: { clinicId_userId: { clinicId: event.clinicId, userId: req.user.sub } },
    });
    if (!membership) throw new ForbiddenError();

    const { status, page = "1", limit = "50" } = req.query as {
      status?: string; page?: string; limit?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: { eventId, ...(status ? { status: status as never } : {}) },
        include: { _count: { select: { duplicates: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.lead.count({ where: { eventId, ...(status ? { status: status as never } : {}) } }),
    ]);

    return { leads, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // Review queue
  app.get("/clinics/:clinicId/review-queue", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    const membership = await prisma.clinicMembership.findUnique({
      where: { clinicId_userId: { clinicId, userId: req.user.sub } },
    });
    if (!membership) throw new ForbiddenError();

    const { status, page = "1", limit = "50" } = req.query as {
      status?: string; page?: string; limit?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const statuses = status ? [status] : ["submitted", "needs_review"];

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: {
          event: { clinicId },
          status: { in: statuses as never[] },
        },
        include: {
          event: { select: { id: true, name: true } },
          _count: { select: { duplicates: true, consents: true } },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.lead.count({
        where: { event: { clinicId }, status: { in: statuses as never[] } },
      }),
    ]);

    return { leads, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // Approve a lead
  app.post("/leads/:id/approve", async (req) => {
    const { id } = req.params as { id: string };
    const body = ApproveLeadSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const lead = await getLeadAndAssertAccess(id, req.user.sub);

    if (!["submitted", "needs_review", "sync_failed", "sync_rejected"].includes(lead.status)) {
      throw new ValidationError(`Cannot approve lead in status: ${lead.status}`);
    }

    // Block approval if unresolved duplicate candidates exist
    const pendingDuplicates = await prisma.duplicateCandidate.count({
      where: { leadId: id, status: "pending" },
    });
    if (pendingDuplicates > 0) {
      throw new ValidationError(
        `Cannot approve: ${pendingDuplicates} unresolved duplicate candidate(s) must be resolved first`,
      );
    }

    // Block approval if required treatment consent is missing
    const requirementsMissing = await prisma.eventConsentRequirement.findMany({
      where: { eventId: lead.event.id, required: true },
    });
    const grantedIds = new Set(
      (await prisma.leadConsent.findMany({
        where: { leadId: id, granted: true },
        select: { consentTemplateVersionId: true },
      })).map((c) => c.consentTemplateVersionId),
    );
    const stillMissing = requirementsMissing.filter((r) => !grantedIds.has(r.consentTemplateVersionId));
    if (stillMissing.length > 0) {
      throw new ValidationError(`Cannot approve: ${stillMissing.length} required consent(s) not granted`);
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: "ready",
        approvedBy: req.user.sub,
        approvedAt: new Date(),
      },
    });

    await recordAudit({
      action: "lead_approved",
      userId: req.user.sub,
      leadId: id,
      payload: { note: body.data.note },
    });

    return updated;
  });

  // Reject a lead
  app.post("/leads/:id/reject", async (req) => {
    const { id } = req.params as { id: string };
    const body = RejectLeadSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    await getLeadAndAssertAccess(id, req.user.sub);

    const updated = await prisma.lead.update({
      where: { id },
      data: { status: "archived", rejectionReason: body.data.reason },
    });

    await recordAudit({
      action: "lead_rejected",
      userId: req.user.sub,
      leadId: id,
      payload: { reason: body.data.reason },
    });

    return updated;
  });

  // Bulk approve
  app.post("/leads/bulk-approve", async (req, reply) => {
    const body = BulkApproveSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const leadId of body.data.leadIds) {
      try {
        // Check pending duplicates
        const pendingDuplicates = await prisma.duplicateCandidate.count({
          where: { leadId, status: "pending" },
        });
        if (pendingDuplicates > 0) {
          results.push({ id: leadId, success: false, error: "Unresolved duplicates" });
          continue;
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "ready", approvedBy: req.user.sub, approvedAt: new Date() },
        });
        await recordAudit({ action: "lead_approved", userId: req.user.sub, leadId });
        results.push({ id: leadId, success: true });
      } catch {
        results.push({ id: leadId, success: false, error: "Update failed" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return reply.status(200).send({ results, successCount, failCount: results.length - successCount });
  });

  // Duplicate resolution
  app.get("/leads/:id/duplicates", async (req) => {
    const { id } = req.params as { id: string };
    await getLeadAndAssertAccess(id, req.user.sub);
    return prisma.duplicateCandidate.findMany({
      where: { leadId: id },
      orderBy: { matchScore: "desc" },
    });
  });

  app.post("/leads/:id/duplicates/:candidateId/resolve", async (req) => {
    const { id, candidateId } = req.params as { id: string; candidateId: string };
    const body = ResolveDuplicateSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    await getLeadAndAssertAccess(id, req.user.sub);

    const candidate = await prisma.duplicateCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.leadId !== id) throw new NotFoundError("DuplicateCandidate");
    if (candidate.status !== "pending") throw new ConflictError("Candidate already resolved");

    const updated = await prisma.duplicateCandidate.update({
      where: { id: candidateId },
      data: {
        status: body.data.status,
        resolvedBy: req.user.sub,
        resolvedAt: new Date(),
        resolutionNote: body.data.resolutionNote,
      },
    });

    await recordAudit({
      action: "duplicate_resolved",
      userId: req.user.sub,
      leadId: id,
      payload: { candidateId, resolution: body.data.status },
    });

    return updated;
  });

  // Merge lead into another
  app.post("/leads/:id/merge-into/:targetLeadId", async (req) => {
    const { id, targetLeadId } = req.params as { id: string; targetLeadId: string };
    const sourceLead = await getLeadAndAssertAccess(id, req.user.sub);
    await getLeadAndAssertAccess(targetLeadId, req.user.sub);

    await prisma.$transaction(async (tx) => {
      // Archive the duplicate
      await tx.lead.update({ where: { id }, data: { status: "archived" } });
      // Mark all candidates involving this pair as merged
      await tx.duplicateCandidate.updateMany({
        where: { leadId: id, candidateRef: targetLeadId },
        data: { status: "merged", resolvedBy: req.user.sub, resolvedAt: new Date() },
      });
    });

    await recordAudit({
      action: "lead_merged",
      userId: req.user.sub,
      leadId: id,
      payload: { targetLeadId },
    });

    return { merged: id, into: targetLeadId };
  });
}
