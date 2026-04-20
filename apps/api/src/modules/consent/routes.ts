import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../../lib/errors.js";
import {
  CreateConsentTemplateSchema,
  CreateConsentTemplateVersionSchema,
  SetEventConsentRequirementsSchema,
} from "@eventintake/shared";

async function assertClinicAccess(clinicId: string, userId: string) {
  const m = await prisma.clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId, userId } },
  });
  if (!m) throw new ForbiddenError();
}

export async function consentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/clinics/:clinicId/consent-templates", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);
    return prisma.consentTemplate.findMany({
      where: { clinicId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/clinics/:clinicId/consent-templates", async (req, reply) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);

    const body = CreateConsentTemplateSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const tmpl = await prisma.consentTemplate.create({
      data: {
        clinicId,
        name: body.data.name,
        consentType: body.data.consentType as never,
        createdBy: req.user.sub,
      },
    });
    return reply.status(201).send(tmpl);
  });

  app.get("/consent-templates/:id/versions", async (req) => {
    const { id } = req.params as { id: string };
    const tmpl = await prisma.consentTemplate.findUnique({ where: { id } });
    if (!tmpl) throw new NotFoundError("ConsentTemplate");
    await assertClinicAccess(tmpl.clinicId, req.user.sub);

    return prisma.consentTemplateVersion.findMany({
      where: { consentTemplateId: id },
      include: { _count: { select: { leadConsents: true } } },
      orderBy: { versionNumber: "desc" },
    });
  });

  app.post("/consent-templates/:id/versions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tmpl = await prisma.consentTemplate.findUnique({ where: { id } });
    if (!tmpl) throw new NotFoundError("ConsentTemplate");
    await assertClinicAccess(tmpl.clinicId, req.user.sub);

    const body = CreateConsentTemplateVersionSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const latest = await prisma.consentTemplateVersion.findFirst({
      where: { consentTemplateId: id },
      orderBy: { versionNumber: "desc" },
    });

    const version = await prisma.consentTemplateVersion.create({
      data: {
        consentTemplateId: id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        bodyText: body.data.bodyText,
        shortLabel: body.data.shortLabel,
        effectiveFrom: new Date(body.data.effectiveFrom),
        effectiveUntil: body.data.effectiveUntil ? new Date(body.data.effectiveUntil) : undefined,
        createdBy: req.user.sub,
      },
    });
    return reply.status(201).send(version);
  });

  // Prevent editing a version that has accepted consents
  app.get("/consent-template-versions/:id", async (req) => {
    const { id } = req.params as { id: string };
    const version = await prisma.consentTemplateVersion.findUnique({
      where: { id },
      include: {
        consentTemplate: true,
        _count: { select: { leadConsents: true } },
      },
    });
    if (!version) throw new NotFoundError("ConsentTemplateVersion");
    await assertClinicAccess(version.consentTemplate.clinicId, req.user.sub);
    return { ...version, isImmutable: version._count.leadConsents > 0 };
  });

  // Event consent requirements
  app.get("/events/:eventId/consent-requirements", async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError("Event");
    await assertClinicAccess(event.clinicId, req.user.sub);

    return prisma.eventConsentRequirement.findMany({
      where: { eventId },
      include: {
        consentTemplateVersion: {
          include: { consentTemplate: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    });
  });

  app.put("/events/:eventId/consent-requirements", async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError("Event");
    await assertClinicAccess(event.clinicId, req.user.sub);

    const body = SetEventConsentRequirementsSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const requirements = await prisma.$transaction(async (tx) => {
      await tx.eventConsentRequirement.deleteMany({ where: { eventId } });
      return tx.eventConsentRequirement.createMany({
        data: body.data.requirements.map((r) => ({
          eventId,
          consentTemplateVersionId: r.consentTemplateVersionId,
          required: r.required,
          displayOrder: r.displayOrder,
        })),
      });
    });

    return requirements;
  });
}
