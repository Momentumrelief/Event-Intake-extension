import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordAudit } from "../audit/service.js";
import { MockEhrAdapter } from "../ehr/mock-adapter.js";
import type { NormalizedLead, FieldMapping } from "@eventintake/shared";

const adapter = new MockEhrAdapter();

async function assertClinicAccess(clinicId: string, userId: string) {
  const m = await prisma.clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId, userId } },
  });
  if (!m) throw new ForbiddenError();
}

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.post("/events/:eventId/export/csv", async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError("Event");
    await assertClinicAccess(event.clinicId, req.user.sub);

    const body = z
      .object({
        leadIds: z.array(z.string().uuid()).optional(),
        includeEhrMapping: z.boolean().optional(),
        ehrConnectionId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const leads = await prisma.lead.findMany({
      where: {
        eventId,
        ...(body.data.leadIds ? { id: { in: body.data.leadIds } } : {}),
      },
      include: {
        fieldValues: { include: { formField: true } },
        consents: {
          include: { consentTemplateVersion: { include: { consentTemplate: true } } },
        },
      },
    });

    let mappings: FieldMapping[] = [];
    if (body.data.includeEhrMapping && body.data.ehrConnectionId) {
      mappings = (await prisma.ehrFieldMapping.findMany({
        where: { ehrConnectionId: body.data.ehrConnectionId },
        orderBy: { displayOrder: "asc" },
      })) as unknown as FieldMapping[];
    }

    const normalized: NormalizedLead[] = leads.map((l) => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email ?? undefined,
      phone: l.phone ?? undefined,
      dateOfBirth: l.dateOfBirth?.toISOString().split("T")[0],
      fieldValues: Object.fromEntries(l.fieldValues.map((fv) => [fv.formField.key, fv.value])),
    }));

    const csv = await adapter.exportCsv(normalized, mappings);

    // Mark as exported and audit
    await prisma.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { status: "exported" },
    });
    for (const lead of leads) {
      await recordAudit({ action: "lead_exported", userId: req.user.sub, leadId: lead.id });
    }

    reply
      .header("Content-Type", "text/csv")
      .header(
        "Content-Disposition",
        `attachment; filename="leads-${eventId}-${Date.now()}.csv"`,
      );
    return reply.send(csv);
  });

  app.get("/leads/:id/copy-packet", async (req) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        event: true,
        fieldValues: { include: { formField: true } },
        consents: {
          include: { consentTemplateVersion: { include: { consentTemplate: true } } },
        },
      },
    });
    if (!lead) throw new NotFoundError("Lead");
    await assertClinicAccess(lead.event.clinicId, req.user.sub);

    return {
      identity: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        dateOfBirth: lead.dateOfBirth?.toISOString().split("T")[0],
      },
      contact: {
        email: lead.email,
        phone: lead.phone,
      },
      clinical: Object.fromEntries(
        lead.fieldValues
          .filter((fv) => ["health", "demographic"].includes(fv.formField.piiCategory))
          .map((fv) => [fv.formField.label, fv.value]),
      ),
      other: Object.fromEntries(
        lead.fieldValues
          .filter((fv) => !["health", "demographic"].includes(fv.formField.piiCategory))
          .map((fv) => [fv.formField.label, fv.value]),
      ),
      consents: lead.consents.map((c) => ({
        type: c.consentTemplateVersion.consentTemplate.consentType,
        name: c.consentTemplateVersion.consentTemplate.name,
        granted: c.granted,
        capturedAt: c.capturedAt,
        versionText: c.consentTemplateVersion.bodyText,
        shortLabel: c.consentTemplateVersion.shortLabel,
      })),
    };
  });
}
