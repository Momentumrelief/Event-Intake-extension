import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { CreateEhrFieldMappingSchema } from "@eventintake/shared";
import { MockEhrAdapter } from "./mock-adapter.js";

async function assertClinicAccess(clinicId: string, userId: string) {
  const m = await prisma.clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId, userId } },
  });
  if (!m) throw new ForbiddenError();
}

const adapter = new MockEhrAdapter();

export async function ehrRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/clinics/:clinicId/ehr-connections", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);
    return prisma.ehrConnection.findMany({
      where: { clinicId },
      select: {
        id: true, clinicId: true, provider: true, clinicUrl: true,
        status: true, lastTestedAt: true, createdAt: true, updatedAt: true,
        // exclude encryptedTokens
      },
    });
  });

  app.get("/ehr-connections/:id/supported-fields", async (req) => {
    const { id } = req.params as { id: string };
    const conn = await prisma.ehrConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundError("EhrConnection");
    await assertClinicAccess(conn.clinicId, req.user.sub);
    return adapter.listSupportedFields();
  });

  app.get("/clinics/:clinicId/ehr-mappings", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    const { connectionId } = req.query as { connectionId?: string };
    await assertClinicAccess(clinicId, req.user.sub);
    return prisma.ehrFieldMapping.findMany({
      where: { clinicId, ...(connectionId ? { ehrConnectionId: connectionId } : {}) },
      orderBy: { displayOrder: "asc" },
    });
  });

  app.post("/clinics/:clinicId/ehr-mappings", async (req, reply) => {
    const { clinicId } = req.params as { clinicId: string };
    await assertClinicAccess(clinicId, req.user.sub);

    const body = CreateEhrFieldMappingSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const mapping = await prisma.ehrFieldMapping.create({
      data: {
        clinicId,
        ehrConnectionId: body.data.ehrConnectionId,
        formFieldKey: body.data.formFieldKey,
        ehrFieldPath: body.data.ehrFieldPath,
        transform: body.data.transform as never,
        fallbackToNote: body.data.fallbackToNote,
        displayOrder: body.data.displayOrder,
      },
    });
    return reply.status(201).send(mapping);
  });

  app.put("/ehr-mappings/:id", async (req) => {
    const { id } = req.params as { id: string };
    const mapping = await prisma.ehrFieldMapping.findUnique({ where: { id } });
    if (!mapping) throw new NotFoundError("EhrFieldMapping");
    await assertClinicAccess(mapping.clinicId, req.user.sub);

    const body = CreateEhrFieldMappingSchema.partial().safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    return prisma.ehrFieldMapping.update({ where: { id }, data: body.data as never });
  });

  app.delete("/ehr-mappings/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const mapping = await prisma.ehrFieldMapping.findUnique({ where: { id } });
    if (!mapping) throw new NotFoundError("EhrFieldMapping");
    await assertClinicAccess(mapping.clinicId, req.user.sub);
    await prisma.ehrFieldMapping.delete({ where: { id } });
    return reply.status(204).send();
  });
}
