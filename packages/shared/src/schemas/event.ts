import { z } from "zod";

export const EventType = z.enum([
  "marathon",
  "medical_conference",
  "health_fair",
  "corporate_event",
  "screening",
  "other",
]);
export type EventType = z.infer<typeof EventType>;

export const EventStatus = z.enum(["draft", "active", "closed", "archived"]);
export type EventStatus = z.infer<typeof EventStatus>;

export const CreateEventSchema = z.object({
  name: z.string().min(1).max(200),
  eventType: EventType,
  locationName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().min(1),
  campaignTags: z.array(z.string()).optional().default([]),
  defaultFormTemplateVersionId: z.string().uuid().optional(),
});
export type CreateEventSchema = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  status: EventStatus.optional(),
});
export type UpdateEventSchema = z.infer<typeof UpdateEventSchema>;

export const EventSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  eventType: EventType,
  locationName: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string(),
  status: EventStatus,
  campaignTags: z.array(z.string()),
  leadCount: z.number().int().optional(),
});
export type EventSummary = z.infer<typeof EventSummary>;
