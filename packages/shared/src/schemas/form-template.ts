import { z } from "zod";

export const IntakeFieldType = z.enum([
  "short_text",
  "long_text",
  "phone",
  "email",
  "address",
  "date",
  "date_of_birth",
  "single_select",
  "multi_select",
  "checkbox",
  "consent_checkbox",
  "number",
]);
export type IntakeFieldType = z.infer<typeof IntakeFieldType>;

export const PiiCategory = z.enum(["none", "contact", "health", "demographic", "insurance"]);
export type PiiCategory = z.infer<typeof PiiCategory>;

export const FieldTransform = z.enum(["none", "uppercase", "date_iso", "phone_e164"]);
export type FieldTransform = z.infer<typeof FieldTransform>;

export const FieldOption = z.object({
  value: z.string(),
  label: z.string(),
});

export const IntakeField = z.object({
  id: z.string().uuid(),
  key: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  label: z.string().min(1).max(200),
  type: IntakeFieldType,
  required: z.boolean(),
  helpText: z.string().max(500).optional(),
  placeholder: z.string().max(200).optional(),
  options: z.array(FieldOption).optional(),
  piiCategory: PiiCategory,
  ehrFieldPath: z.string().optional(),
  ehrTransform: FieldTransform.optional(),
  ehrFallbackToNote: z.boolean().optional(),
  displayOrder: z.number().int().min(0),
});
export type IntakeField = z.infer<typeof IntakeField>;

export const CreateFormFieldSchema = IntakeField.omit({ id: true });
export type CreateFormFieldSchema = z.infer<typeof CreateFormFieldSchema>;

export const FormTemplateVersionSchema = z.object({
  id: z.string().uuid(),
  formTemplateId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  isPublished: z.boolean(),
  publishedAt: z.string().datetime().optional(),
  fields: z.array(IntakeField),
  createdAt: z.string().datetime(),
});
export type FormTemplateVersionSchema = z.infer<typeof FormTemplateVersionSchema>;

export const CreateFormTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  fields: z.array(CreateFormFieldSchema),
});
export type CreateFormTemplateSchema = z.infer<typeof CreateFormTemplateSchema>;

// Built-in event-type presets
export const FORM_PRESETS: Record<string, CreateFormFieldSchema[]> = {
  marathon: [
    { key: "first_name", label: "First Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 0 },
    { key: "last_name", label: "Last Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 1 },
    { key: "phone", label: "Phone", type: "phone", required: true, piiCategory: "contact", displayOrder: 2, ehrFieldPath: "patient.phone", ehrTransform: "phone_e164", ehrFallbackToNote: false },
    { key: "email", label: "Email", type: "email", required: false, piiCategory: "contact", displayOrder: 3, ehrFieldPath: "patient.email", ehrTransform: "none", ehrFallbackToNote: false },
    { key: "chief_complaint", label: "Chief Complaint / Injury Area", type: "short_text", required: false, piiCategory: "health", displayOrder: 4, ehrFieldPath: "patient.chiefComplaint", ehrTransform: "none", ehrFallbackToNote: true },
    { key: "activity_level", label: "Activity Level", type: "single_select", required: false, piiCategory: "none", options: [{ value: "recreational", label: "Recreational" }, { value: "competitive", label: "Competitive" }, { value: "elite", label: "Elite" }], displayOrder: 5, ehrFallbackToNote: true },
    { key: "preferred_contact", label: "Preferred Contact Method", type: "single_select", required: false, piiCategory: "none", options: [{ value: "phone", label: "Phone" }, { value: "email", label: "Email" }, { value: "text", label: "Text" }], displayOrder: 6 },
  ],
  medical_conference: [
    { key: "first_name", label: "First Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 0 },
    { key: "last_name", label: "Last Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 1 },
    { key: "organization", label: "Organization", type: "short_text", required: false, piiCategory: "none", displayOrder: 2 },
    { key: "role", label: "Role / Title", type: "short_text", required: false, piiCategory: "none", displayOrder: 3 },
    { key: "email", label: "Email", type: "email", required: true, piiCategory: "contact", displayOrder: 4 },
    { key: "phone", label: "Phone", type: "phone", required: false, piiCategory: "contact", displayOrder: 5 },
    { key: "service_interest", label: "Service Interest", type: "multi_select", required: false, piiCategory: "none", options: [{ value: "physiotherapy", label: "Physiotherapy" }, { value: "chiropractic", label: "Chiropractic" }, { value: "massage", label: "Massage Therapy" }, { value: "other", label: "Other" }], displayOrder: 6 },
    { key: "notes", label: "Notes", type: "long_text", required: false, piiCategory: "none", displayOrder: 7 },
  ],
  health_fair: [
    { key: "first_name", label: "First Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 0 },
    { key: "last_name", label: "Last Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 1 },
    { key: "phone", label: "Phone", type: "phone", required: true, piiCategory: "contact", displayOrder: 2 },
    { key: "email", label: "Email", type: "email", required: false, piiCategory: "contact", displayOrder: 3 },
    { key: "address", label: "Address", type: "address", required: false, piiCategory: "contact", displayOrder: 4 },
    { key: "complaint_goal", label: "Complaint or Health Goal", type: "long_text", required: false, piiCategory: "health", displayOrder: 5, ehrFallbackToNote: true },
    { key: "preferred_location", label: "Preferred Clinic Location", type: "short_text", required: false, piiCategory: "none", displayOrder: 6 },
  ],
  corporate_event: [
    { key: "first_name", label: "First Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 0 },
    { key: "last_name", label: "Last Name", type: "short_text", required: true, piiCategory: "contact", displayOrder: 1 },
    { key: "phone", label: "Phone", type: "phone", required: true, piiCategory: "contact", displayOrder: 2 },
    { key: "email", label: "Email", type: "email", required: true, piiCategory: "contact", displayOrder: 3 },
    { key: "service_interest", label: "Service Interest", type: "multi_select", required: false, piiCategory: "none", options: [{ value: "physiotherapy", label: "Physiotherapy" }, { value: "massage", label: "Massage Therapy" }, { value: "ergonomics", label: "Ergonomics Assessment" }, { value: "other", label: "Other" }], displayOrder: 4 },
    { key: "availability", label: "Availability", type: "multi_select", required: false, piiCategory: "none", options: [{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "evening", label: "Evening" }], displayOrder: 5 },
  ],
};
