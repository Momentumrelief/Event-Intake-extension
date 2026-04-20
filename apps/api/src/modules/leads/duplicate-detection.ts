import { prisma } from "../../lib/prisma.js";

interface DuplicateInput {
  leadId: string;
  clinicId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
}

export async function detectInternalDuplicates(input: DuplicateInput): Promise<number> {
  if (!input.email && !input.phone) return 0;

  const candidates = await prisma.lead.findMany({
    where: {
      id: { not: input.leadId },
      event: { clinicId: input.clinicId },
      status: { not: "archived" },
      OR: [
        ...(input.email ? [{ email: input.email }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
    },
  });

  let created = 0;
  for (const candidate of candidates) {
    const matchReason: string[] = [];
    let score = 0;

    if (input.email && candidate.email === input.email) {
      matchReason.push("email");
      score += 0.5;
    }
    if (input.phone && candidate.phone === input.phone) {
      matchReason.push("phone");
      score += 0.4;
    }
    if (
      input.firstName.toLowerCase() === candidate.firstName.toLowerCase() &&
      input.lastName.toLowerCase() === candidate.lastName.toLowerCase()
    ) {
      matchReason.push("name");
      score += 0.1;
    }
    if (
      input.dateOfBirth &&
      candidate.dateOfBirth &&
      input.dateOfBirth.toISOString() === candidate.dateOfBirth.toISOString()
    ) {
      matchReason.push("date_of_birth");
      score += 0.2;
    }

    if (matchReason.length > 0) {
      const existing = await prisma.duplicateCandidate.findFirst({
        where: { leadId: input.leadId, candidateRef: candidate.id },
      });
      if (!existing) {
        await prisma.duplicateCandidate.create({
          data: {
            leadId: input.leadId,
            candidateType: "internal_lead",
            candidateRef: candidate.id,
            matchReason: JSON.stringify(matchReason),
            matchScore: Math.min(score, 1),
          },
        });
        created++;
      }
    }
  }

  return created;
}
