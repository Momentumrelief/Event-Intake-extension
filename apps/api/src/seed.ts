import { prisma } from "./lib/prisma.js";
import bcrypt from "bcryptjs";

async function seed() {
  console.warn("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name: "Demo Clinic Group" },
  });

  const clinic = await prisma.clinic.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      organizationId: org.id,
      name: "Westside Physiotherapy",
      timezone: "America/Vancouver",
      country: "CA",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      passwordHash,
      firstName: "Admin",
      lastName: "Demo",
    },
  });

  await prisma.clinicMembership.upsert({
    where: { clinicId_userId: { clinicId: clinic.id, userId: user.id } },
    update: {},
    create: { clinicId: clinic.id, userId: user.id, role: "owner" },
  });

  console.warn("Seed complete.");
  console.warn("  Login: admin@demo.com / password123");
  console.warn("  Clinic ID:", clinic.id);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
