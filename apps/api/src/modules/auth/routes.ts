import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ValidationError } from "../../lib/errors.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(200),
  clinicName: z.string().min(1).max(200),
  timezone: z.string().default("America/Toronto"),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (req, reply) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const user = await prisma.user.findUnique({
      where: { email: body.data.email.toLowerCase() },
      include: {
        memberships: { include: { clinic: true } },
      },
    });

    if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: process.env["JWT_ACCESS_EXPIRY"] ?? "1h" },
    );

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        clinics: user.memberships.map((m) => ({
          id: m.clinic.id,
          name: m.clinic.name,
          role: m.role,
        })),
      },
    };
  });

  app.post("/auth/register", async (req, reply) => {
    const body = RegisterSchema.safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);

    const existing = await prisma.user.findUnique({
      where: { email: body.data.email.toLowerCase() },
    });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(body.data.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: body.data.organizationName },
      });
      const clinic = await tx.clinic.create({
        data: {
          organizationId: org.id,
          name: body.data.clinicName,
          timezone: body.data.timezone,
        },
      });
      const newUser = await tx.user.create({
        data: {
          email: body.data.email.toLowerCase(),
          passwordHash,
          firstName: body.data.firstName,
          lastName: body.data.lastName,
        },
      });
      await tx.clinicMembership.create({
        data: { clinicId: clinic.id, userId: newUser.id, role: "owner" },
      });
      return { user: newUser, clinic };
    });

    const token = app.jwt.sign(
      { sub: user.user.id, email: user.user.email },
      { expiresIn: process.env["JWT_ACCESS_EXPIRY"] ?? "1h" },
    );

    return reply.status(201).send({
      accessToken: token,
      user: {
        id: user.user.id,
        email: user.user.email,
        firstName: user.user.firstName,
        lastName: user.user.lastName,
        clinics: [{ id: user.clinic.id, name: user.clinic.name, role: "owner" }],
      },
    });
  });

  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (req) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.sub },
        include: { memberships: { include: { clinic: true } } },
      });
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        clinics: user.memberships.map((m) => ({
          id: m.clinic.id,
          name: m.clinic.name,
          role: m.role,
        })),
      };
    },
  );
}
