import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { CreateEventSchema, UpdateEventSchema } from "@eventintake/shared";

async function assertClinicAccess(clinicId: string, userId: string): Promise<void> {
  const membership = await prisma.clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId, userId } },
  });
  if (!membership) throw new ForbiddenError();
}

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/clinics/:clinicId/events", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);

    const { status } = req.query as { status?: string };
    const events = await prisma.event.findMany({
      where: {
        clinicId,
        ...(status ? { status: status as never } : {}),
      },
      include: { _count: { select: { leads: true } } },
      orderBy: { startAt: "desc" },
    });

    return events.map((e) => ({
      id: e.id,
      name: e.name,
      eventType: e.eventType,
      locationName: e.locationName,
      startAt: e.startAt,
      endAt: e.endAt,
      timezone: e.timezone,
      status: e.status,
      campaignTags: JSON.parse(e.campaignTags || "[]") as string[],
      leadCount: e._count.leads,
      defaultFormTemplateVersionId: e.defaultFormTemplateVersionId,
    }));
  });

  app.post("/clinics/:clinicId/events", async (req, reply) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);

    const body = CreateEventSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const event = await prisma.event.create({
      data: {
        clinicId,
        name: body.data.name,
        eventType: body.data.eventType as never,
        locationName: body.data.locationName,
        address: body.data.address,
        startAt: new Date(body.data.startAt),
        endAt: new Date(body.data.endAt),
        timezone: body.data.timezone,
        campaignTags: JSON.stringify(body.data.campaignTags ?? []),
        defaultFormTemplateVersionId: body.data.defaultFormTemplateVersionId,
      },
    });

    return reply.status(201).send(event);
  });

  app.get("/events/:id", async (req) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        consentRequirements: {
          include: {
            consentTemplateVersion: {
              include: { consentTemplate: true },
            },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });
    if (!event) throw new NotFoundError("Event");
    await assertClinicAccess(event.clinicId, req.user.sub);
    return event;
  });

  app.patch("/events/:id", async (req) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError("Event");
    await assertClinicAccess(event.clinicId, req.user.sub);

    const body = UpdateEventSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(body.data.name && { name: body.data.name }),
        ...(body.data.eventType && { eventType: body.data.eventType as never }),
        ...(body.data.locationName !== undefined && { locationName: body.data.locationName }),
        ...(body.data.address !== undefined && { address: body.data.address }),
        ...(body.data.startAt && { startAt: new Date(body.data.startAt) }),
        ...(body.data.endAt && { endAt: new Date(body.data.endAt) }),
        ...(body.data.timezone && { timezone: body.data.timezone }),
        ...(body.data.campaignTags && { campaignTags: JSON.stringify(body.data.campaignTags) }),
        ...(body.data.status && { status: body.data.status as never }),
        ...(body.data.defaultFormTemplateVersionId !== undefined && {
          defaultFormTemplateVersionId: body.data.defaultFormTemplateVersionId,
        }),
      },
    });
    return updated;
  });

  // Form template routes
  app.get("/clinics/:clinicId/form-templates", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);
    const templates = await prisma.formTemplate.findMany({
      where: { clinicId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { _count: { select: { fields: true, leads: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return templates.map((t) => {
      const [latest] = t.versions;
      return {
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        latestVersion: latest
          ? {
              id: latest.id,
              versionNumber: latest.versionNumber,
              isPublished: latest.isPublished,
              publishedAt: latest.publishedAt,
              fieldCount: latest._count.fields,
              leadCount: latest._count.leads,
            }
          : null,
      };
    });
  });

  app.post("/clinics/:clinicId/form-templates", async (req, reply) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);

    const BodySchema = z.object({
      name: z.string().min(1).max(200),
      fields: z.array(z.any()),
      publish: z.boolean().optional().default(true),
    });
    const body = BodySchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const template = await prisma.$transaction(async (tx) => {
      const tmpl = await tx.formTemplate.create({
        data: { clinicId, name: body.data.name },
      });
      const version = await tx.formTemplateVersion.create({
        data: {
          formTemplateId: tmpl.id,
          versionNumber: 1,
          isPublished: body.data.publish,
          publishedAt: body.data.publish ? new Date() : null,
        },
      });
      const fields = body.data.fields as Array<{
        key: string; label: string; type: string; required: boolean;
        helpText?: string; placeholder?: string; options?: unknown;
        piiCategory: string; ehrFieldPath?: string; ehrTransform?: string;
        ehrFallbackToNote?: boolean; displayOrder: number;
      }>;
      await tx.formField.createMany({
        data: fields.map((f) => ({
          formTemplateVersionId: version.id,
          key: f.key,
          label: f.label,
          type: f.type as never,
          required: f.required,
          helpText: f.helpText,
          placeholder: f.placeholder,
          // options is a JSON-serialized string in SQLite
          options: f.options ? JSON.stringify(f.options) : null,
          piiCategory: (f.piiCategory as never) ?? "none",
          ehrFieldPath: f.ehrFieldPath,
          ehrTransform: f.ehrTransform as never,
          ehrFallbackToNote: f.ehrFallbackToNote ?? false,
          displayOrder: f.displayOrder,
        })),
      });
      return { ...tmpl, currentVersionId: version.id };
    });

    return reply.status(201).send(template);
  });

  app.get("/form-templates/:id/versions", async (req) => {
    const { id } = req.params as { id: string };
    const tmpl = await prisma.formTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          include: { fields: { orderBy: { displayOrder: "asc" } } },
          orderBy: { versionNumber: "desc" },
        },
      },
    });
    if (!tmpl) throw new NotFoundError("FormTemplate");
    await assertClinicAccess(tmpl.clinicId, req.user.sub);
    return tmpl.versions;
  });

  app.post("/form-templates/:id/versions/publish", async (req) => {
    const { id } = req.params as { id: string };
    const { versionId } = req.body as { versionId: string };
    const version = await prisma.formTemplateVersion.findUnique({
      where: { id: versionId },
      include: { formTemplate: true },
    });
    if (!version || version.formTemplateId !== id) throw new NotFoundError("FormTemplateVersion");
    await assertClinicAccess(version.formTemplate.clinicId, req.user.sub);

    return prisma.formTemplateVersion.update({
      where: { id: versionId },
      data: { isPublished: true, publishedAt: new Date() },
    });
  });

  app.get("/form-template-versions/:id", async (req) => {
    const { id } = req.params as { id: string };
    const version = await prisma.formTemplateVersion.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { displayOrder: "asc" } },
        formTemplate: true,
      },
    });
    if (!version) throw new NotFoundError("FormTemplateVersion");
    await assertClinicAccess(version.formTemplate.clinicId, req.user.sub);
    // options is stored as a JSON-serialized string in SQLite; parse before returning
    // so the extension can consume field.options[].value / .label directly.
    return {
      ...version,
      fields: version.fields.map((f) => ({
        ...f,
        options: f.options ? (JSON.parse(f.options) as Array<{ value: string; label: string }>) : null,
      })),
    };
  });
}
