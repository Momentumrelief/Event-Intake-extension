import { Worker, type Job } from "bullmq";
import { prisma } from "../../lib/prisma.js";
import { getRedis } from "../../lib/redis.js";
import { recordAudit } from "../audit/service.js";
import { MockEhrAdapter } from "../ehr/mock-adapter.js";
import type { NormalizedLead, FieldMapping } from "@eventintake/shared";

const adapter = new MockEhrAdapter();

interface SyncJobPayload {
  syncJobId: string;
  leadId: string;
}

export function startSyncWorker() {
  const redis = getRedis();

  const worker = new Worker<SyncJobPayload>(
    "ehr-sync",
    async (job: Job<SyncJobPayload>) => {
      const { syncJobId, leadId } = job.data;

      const syncJob = await prisma.ehrSyncJob.findUnique({ where: { id: syncJobId } });
      if (!syncJob || syncJob.status === "cancelled") return;

      await prisma.ehrSyncJob.update({
        where: { id: syncJobId },
        data: { status: "running", lastAttemptedAt: new Date(), attemptCount: { increment: 1 } },
      });
      await prisma.lead.update({ where: { id: leadId }, data: { status: "syncing" } });
      await recordAudit({ action: "sync_started", leadId });

      try {
        const lead = await prisma.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: { fieldValues: { include: { formField: true } } },
        });

        const normalized: NormalizedLead = {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          dateOfBirth: lead.dateOfBirth?.toISOString().split("T")[0],
          fieldValues: Object.fromEntries(
            lead.fieldValues.map((fv) => [fv.formField.key, fv.value]),
          ),
        };

        const mappings = (JSON.parse(syncJob.fieldMappingSnapshot ?? "[]")) as FieldMapping[];

        // EHR duplicate check before any write
        const duplicates = await adapter.searchPatient(syncJob.ehrConnectionId, {
          email: normalized.email,
          phone: normalized.phone,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          dateOfBirth: normalized.dateOfBirth,
        });

        if (duplicates.length > 0) {
          await prisma.duplicateCandidate.createMany({
            data: duplicates.map((d) => ({
              leadId,
              candidateType: "ehr_patient",
              candidateRef: d.ehrPatientId,
              matchReason: JSON.stringify(["ehr_search"]),
              matchScore: d.matchScore,
            })),
            skipDuplicates: true,
          });
          await prisma.lead.update({ where: { id: leadId }, data: { status: "needs_review" } });
          await prisma.ehrSyncJob.update({ where: { id: syncJobId }, data: { status: "cancelled" } });
          await recordAudit({ action: "sync_failed", leadId, payload: { reason: "ehr_duplicates_found" } });
          return;
        }

        const ref = await adapter.createPatient(syncJob.ehrConnectionId, normalized, mappings);

        await prisma.$transaction([
          prisma.ehrSyncJob.update({
            where: { id: syncJobId },
            data: { status: "succeeded", ehrPatientId: ref.ehrPatientId },
          }),
          prisma.lead.update({ where: { id: leadId }, data: { status: "synced" } }),
          prisma.ehrPatientRef.upsert({
            where: { leadId },
            create: { leadId, ehrProvider: ref.ehrProvider, ehrPatientId: ref.ehrPatientId },
            update: { ehrPatientId: ref.ehrPatientId },
          }),
        ]);

        await recordAudit({ action: "sync_succeeded", leadId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isPermFail = job.attemptsMade >= (syncJob.maxAttempts - 1);
        const nextStatus = isPermFail ? "rejected" : "failed";
        const leadNextStatus = isPermFail ? "sync_rejected" : "sync_failed";

        await prisma.ehrSyncJob.update({
          where: { id: syncJobId },
          data: {
            status: nextStatus,
            errorMessage: message,
            nextRetryAt: isPermFail
              ? null
              : new Date(Date.now() + 60_000 * Math.pow(2, job.attemptsMade)),
          },
        });
        await prisma.lead.update({ where: { id: leadId }, data: { status: leadNextStatus } });
        await recordAudit({
          action: isPermFail ? "sync_rejected" : "sync_failed",
          leadId,
          payload: { error: message, attempt: job.attemptsMade },
        });

        if (!isPermFail) throw err;
      }
    },
    { connection: redis, concurrency: 5 },
  );

  worker.on("error", () => {
    // Redis connection errors suppressed — worker disabled when Redis unavailable
  });

  return worker;
}
