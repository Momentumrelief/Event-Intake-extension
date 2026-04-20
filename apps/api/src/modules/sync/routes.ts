import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import { prisma } from "../../lib/prisma.js";
import { getRedis } from "../../lib/redis.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordAudit } from "../audit/service.js";
import { SyncLeadSchema, BulkSyncSchema } from "@eventintake/shared";

function getSyncQueue() {
  return new Queue("ehr-sync", { connection: getRedis() });
}

async function assertLeadAccess(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { event: true },
  });
  if (!lead) throw new NotFoundError("Lead");
  const m = await prisma.clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId: lead.event.clinicId, userId } },
  });
  if (!m) throw new ForbiddenError();
  return lead;
}

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.post("/leads/:id/sync", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = SyncLeadSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const lead = await assertLeadAccess(id, req.user.sub);
    if (lead.status !== "ready") {
      throw new ValidationError(`Lead must be in 'ready' status to sync; currently '${lead.status}'`);
    }

    // Snapshot field mappings at queue time
    const mappings = await prisma.ehrFieldMapping.findMany({
      where: { ehrConnectionId: body.data.ehrConnectionId },
    });

    const job = await prisma.ehrSyncJob.create({
      data: {
        leadId: id,
        ehrConnectionId: body.data.ehrConnectionId,
        status: "queued",
        fieldMappingSnapshot: mappings as never,
      },
    });

    await prisma.lead.update({ where: { id }, data: { status: "sync_queued" } });

    const queue = getSyncQueue();
    await queue.add("sync-lead", { syncJobId: job.id, leadId: id }, {
      jobId: job.id,
      attempts: 5,
      backoff: { type: "exponential", delay: 60_000 },
    });

    await recordAudit({ action: "sync_queued", userId: req.user.sub, leadId: id });
    return reply.status(202).send(job);
  });

  app.post("/leads/bulk-sync", async (req, reply) => {
    const body = BulkSyncSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const results: Array<{ id: string; success: boolean; jobId?: string; error?: string }> = [];
    const queue = getSyncQueue();

    for (const leadId of body.data.leadIds) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          include: { event: true },
        });
        if (!lead || lead.status !== "ready") {
          results.push({ id: leadId, success: false, error: "Lead not ready" });
          continue;
        }

        const mappings = await prisma.ehrFieldMapping.findMany({
          where: { ehrConnectionId: body.data.ehrConnectionId },
        });

        const job = await prisma.ehrSyncJob.create({
          data: {
            leadId,
            ehrConnectionId: body.data.ehrConnectionId,
            status: "queued",
            fieldMappingSnapshot: mappings as never,
          },
        });

        await prisma.lead.update({ where: { id: leadId }, data: { status: "sync_queued" } });
        await queue.add("sync-lead", { syncJobId: job.id, leadId }, { jobId: job.id, attempts: 5, backoff: { type: "exponential", delay: 60_000 } });
        await recordAudit({ action: "sync_queued", userId: req.user.sub, leadId });
        results.push({ id: leadId, success: true, jobId: job.id });
      } catch {
        results.push({ id: leadId, success: false, error: "Failed to queue" });
      }
    }

    return reply.status(202).send({ results });
  });

  app.get("/leads/:id/sync-jobs", async (req) => {
    const { id } = req.params as { id: string };
    await assertLeadAccess(id, req.user.sub);
    return prisma.ehrSyncJob.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/leads/:id/sync-jobs/:jobId/cancel", async (req) => {
    const { id, jobId } = req.params as { id: string; jobId: string };
    await assertLeadAccess(id, req.user.sub);

    const syncJob = await prisma.ehrSyncJob.findUnique({ where: { id: jobId } });
    if (!syncJob || syncJob.leadId !== id) throw new NotFoundError("SyncJob");
    if (syncJob.status !== "queued") throw new ValidationError("Only queued jobs can be cancelled");

    await prisma.ehrSyncJob.update({
      where: { id: jobId },
      data: { status: "cancelled", cancelledBy: req.user.sub },
    });
    await prisma.lead.update({ where: { id }, data: { status: "ready" } });
    await recordAudit({ action: "sync_cancelled", userId: req.user.sub, leadId: id });
    return { cancelled: true };
  });

  app.post("/leads/:id/sync-jobs/:jobId/retry", async (req, reply) => {
    const { id, jobId } = req.params as { id: string; jobId: string };
    await assertLeadAccess(id, req.user.sub);

    const syncJob = await prisma.ehrSyncJob.findUnique({ where: { id: jobId } });
    if (!syncJob || syncJob.leadId !== id) throw new NotFoundError("SyncJob");
    if (!["rejected", "failed"].includes(syncJob.status)) {
      throw new ValidationError("Only rejected or failed jobs can be manually retried");
    }

    await prisma.ehrSyncJob.update({ where: { id: jobId }, data: { status: "queued", nextRetryAt: null } });
    await prisma.lead.update({ where: { id }, data: { status: "sync_queued" } });

    const queue = getSyncQueue();
    await queue.add("sync-lead", { syncJobId: jobId, leadId: id }, { attempts: 5, backoff: { type: "exponential", delay: 60_000 } });

    return reply.status(202).send({ requeued: true });
  });

  app.get("/clinics/:clinicId/sync-summary", async (req) => {
    const { clinicId } = req.params as { clinicId: string };
    const m = await prisma.clinicMembership.findUnique({
      where: { clinicId_userId: { clinicId, userId: req.user.sub } },
    });
    if (!m) throw new ForbiddenError();

    const [queued, running, succeeded, failed, rejected] = await Promise.all([
      prisma.ehrSyncJob.count({ where: { lead: { event: { clinicId } }, status: "queued" } }),
      prisma.ehrSyncJob.count({ where: { lead: { event: { clinicId } }, status: "running" } }),
      prisma.ehrSyncJob.count({ where: { lead: { event: { clinicId } }, status: "succeeded" } }),
      prisma.ehrSyncJob.count({ where: { lead: { event: { clinicId } }, status: "failed" } }),
      prisma.ehrSyncJob.count({ where: { lead: { event: { clinicId } }, status: "rejected" } }),
    ]);

    return { queued, running, succeeded, failed, rejected };
  });
}
