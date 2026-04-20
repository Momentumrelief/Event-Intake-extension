import { prisma } from "../../lib/prisma.js";

interface AuditParams {
  action: string;
  userId?: string;
  leadId?: string;
  payload?: Record<string, unknown>;
}

export async function recordAudit(params: AuditParams): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      action: params.action,
      userId: params.userId,
      leadId: params.leadId,
      payload: params.payload ?? undefined,
    },
  });
}
