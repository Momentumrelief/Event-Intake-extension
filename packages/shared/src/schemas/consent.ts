import { z } from "zod";

export const ConsentType = z.enum(["contact", "marketing", "treatment", "custom"]);
export type ConsentType = z.infer<typeof ConsentType>;

export const ConsentTemplateVersionSchema = z.object({
  id: z.string().uuid(),
  consentTemplateId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  bodyText: z.string().min(1),
  shortLabel: z.string().min(1).max(300),
  effectiveFrom: z.string().date(),
  effectiveUntil: z.string().date().optional(),
  createdAt: z.string().datetime(),
});
export type ConsentTemplateVersionSchema = z.infer<typeof ConsentTemplateVersionSchema>;

export const CreateConsentTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  consentType: ConsentType,
});
export type CreateConsentTemplateSchema = z.infer<typeof CreateConsentTemplateSchema>;

export const CreateConsentTemplateVersionSchema = z.object({
  bodyText: z.string().min(10),
  shortLabel: z.string().min(1).max(300),
  effectiveFrom: z.string().date(),
  effectiveUntil: z.string().date().optional(),
});
export type CreateConsentTemplateVersionSchema = z.infer<typeof CreateConsentTemplateVersionSchema>;

export const EventConsentRequirementSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  consentTemplateVersionId: z.string().uuid(),
  required: z.boolean(),
  displayOrder: z.number().int().min(0),
  consentTemplate: z
    .object({
      name: z.string(),
      consentType: ConsentType,
    })
    .optional(),
  version: ConsentTemplateVersionSchema.optional(),
});
export type EventConsentRequirementSchema = z.infer<typeof EventConsentRequirementSchema>;

export const SetEventConsentRequirementsSchema = z.object({
  requirements: z.array(
    z.object({
      consentTemplateVersionId: z.string().uuid(),
      required: z.boolean(),
      displayOrder: z.number().int().min(0),
    }),
  ),
});
export type SetEventConsentRequirementsSchema = z.infer<typeof SetEventConsentRequirementsSchema>;
