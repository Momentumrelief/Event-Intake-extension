import { prisma } from "./lib/prisma.js";
import bcrypt from "bcryptjs";

// Stable UUIDs for top-level entities so re-running this seed is idempotent.
// Child tables (form fields, event consent requirements, lead field values, lead
// consents, ehr patient refs) are upserted by their composite unique keys so the
// seed self-heals even if older seed runs left rows with different auto-generated ids.
const ID = {
  org: "00000000-0000-0000-0000-000000000001",
  clinic: "00000000-0000-0000-0000-000000000002",

  formMarathon: "11110000-0000-0000-0000-000000000001",
  formHealthFair: "11110000-0000-0000-0000-000000000002",
  formEmployer: "11110000-0000-0000-0000-000000000003",
  formMarathonV1: "11111111-0000-0000-0000-000000000001",
  formHealthFairV1: "11111111-0000-0000-0000-000000000002",
  formEmployerV1: "11111111-0000-0000-0000-000000000003",

  consentContact: "33330000-0000-0000-0000-000000000001",
  consentMarketing: "33330000-0000-0000-0000-000000000002",
  consentTreatment: "33330000-0000-0000-0000-000000000003",
  consentContactV1: "33331111-0000-0000-0000-000000000001",
  consentMarketingV1: "33331111-0000-0000-0000-000000000002",
  consentTreatmentV1: "33331111-0000-0000-0000-000000000003",

  eventMarathon: "44440000-0000-0000-0000-000000000001",
  eventHealthFair: "44440000-0000-0000-0000-000000000002",
  eventEmployer: "44440000-0000-0000-0000-000000000003",
};

interface FieldDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  piiCategory: string;
  // Options are stored as JSON-serialized { value, label } objects so the extension
  // FieldRenderer (which reads field.options[].value / .label) works directly.
  options?: Array<{ value: string; label: string }> | undefined;
  helpText?: string | undefined;
  placeholder?: string | undefined;
  ehrFieldPath?: string | undefined;
}

const CONCERN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Lower back pain", label: "Lower back pain" },
  { value: "Knee pain", label: "Knee pain" },
  { value: "Shoulder pain", label: "Shoulder pain" },
  { value: "Neck / posture", label: "Neck / posture" },
  { value: "Other", label: "Other" },
];

const RACE_DISTANCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "5K", label: "5K" },
  { value: "10K", label: "10K" },
  { value: "Half marathon", label: "Half marathon" },
  { value: "Marathon", label: "Marathon" },
];

async function seed(): Promise<void> {
  console.warn("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.organization.upsert({
    where: { id: ID.org },
    update: {},
    create: { id: ID.org, name: "Demo Clinic Group" },
  });

  await prisma.clinic.upsert({
    where: { id: ID.clinic },
    update: {},
    create: {
      id: ID.clinic,
      organizationId: ID.org,
      name: "Westside Physiotherapy",
      timezone: "America/Vancouver",
      country: "CA",
    },
  });

  // Upsert by email — earlier seed runs created the user with an auto-generated id, so
  // we resolve the actual id at runtime and reuse it everywhere below.
  const user = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: { passwordHash },
    create: {
      email: "admin@demo.com",
      passwordHash,
      firstName: "Admin",
      lastName: "Demo",
    },
  });
  const userId = user.id;

  await prisma.clinicMembership.upsert({
    where: { clinicId_userId: { clinicId: ID.clinic, userId } },
    update: {},
    create: {
      clinicId: ID.clinic,
      userId,
      role: "owner",
    },
  });

  // ---------- Form templates ----------
  // Field keys are snake_case per the shared IntakeField schema regex and the
  // architecture doc. The extension's LeadForm looks up first_name / last_name /
  // date_of_birth by these keys to build the top-level Lead payload.
  const sharedContactFields: FieldDef[] = [
    { key: "first_name", label: "First name", type: "short_text", required: true, piiCategory: "contact", ehrFieldPath: "patient.first_name" },
    { key: "last_name", label: "Last name", type: "short_text", required: true, piiCategory: "contact", ehrFieldPath: "patient.last_name" },
    { key: "email", label: "Email", type: "email", required: true, piiCategory: "contact", ehrFieldPath: "patient.email" },
    { key: "phone", label: "Mobile phone", type: "phone", required: true, piiCategory: "contact", ehrFieldPath: "patient.cell_phone" },
  ];

  await upsertFormTemplate(ID.formMarathon, ID.formMarathonV1, "Race Expo Intake", [
    ...sharedContactFields,
    { key: "race_distance", label: "Race distance", type: "single_select", required: false, piiCategory: "none", options: RACE_DISTANCE_OPTIONS },
    { key: "primary_concern", label: "Primary concern (if any)", type: "single_select", required: false, piiCategory: "health", options: CONCERN_OPTIONS },
  ]);

  await upsertFormTemplate(ID.formHealthFair, ID.formHealthFairV1, "Health Fair Intake", [
    ...sharedContactFields,
    { key: "date_of_birth", label: "Date of birth", type: "date_of_birth", required: false, piiCategory: "demographic", ehrFieldPath: "patient.dob" },
    { key: "primary_concern", label: "Primary concern", type: "single_select", required: true, piiCategory: "health", options: CONCERN_OPTIONS },
    { key: "current_treatment", label: "Currently receiving treatment elsewhere?", type: "long_text", required: false, piiCategory: "health" },
  ]);

  await upsertFormTemplate(ID.formEmployer, ID.formEmployerV1, "Employer Benefits Day Intake", [
    ...sharedContactFields,
    { key: "employer", label: "Employer", type: "short_text", required: true, piiCategory: "demographic" },
    { key: "primary_concern", label: "Primary concern", type: "single_select", required: false, piiCategory: "health", options: CONCERN_OPTIONS },
  ]);

  // ---------- Consent templates ----------
  await upsertConsentTemplate(userId, ID.consentContact, ID.consentContactV1, "Contact Permission", "contact", "Contact me about my intake",
    "I agree to be contacted by Westside Physiotherapy by phone or email regarding the information I have provided today.");

  await upsertConsentTemplate(userId, ID.consentMarketing, ID.consentMarketingV1, "Marketing Communications", "marketing", "Send me clinic updates",
    "I would like to receive occasional newsletters, promotions, and clinic updates from Westside Physiotherapy. I can unsubscribe at any time.");

  await upsertConsentTemplate(userId, ID.consentTreatment, ID.consentTreatmentV1, "Brief Screening Consent", "treatment", "Consent to brief screening today",
    "I consent to a brief, non-diagnostic musculoskeletal screening provided by clinic staff at this event today.");

  // ---------- Events ----------
  await upsertEvent({
    id: ID.eventMarathon,
    name: "Vancouver Marathon Expo 2026",
    eventType: "marathon",
    locationName: "BC Place",
    address: "777 Pacific Blvd, Vancouver, BC",
    startAt: new Date("2026-05-01T15:00:00-07:00"),
    endAt: new Date("2026-05-02T20:00:00-07:00"),
    formVersionId: ID.formMarathonV1,
    campaignTags: ["spring-2026", "running"],
    requiredConsents: [
      { versionId: ID.consentContactV1, required: true, displayOrder: 1 },
      { versionId: ID.consentMarketingV1, required: false, displayOrder: 2 },
    ],
  });

  await upsertEvent({
    id: ID.eventHealthFair,
    name: "Westside Health Fair 2026",
    eventType: "health_fair",
    locationName: "Kerrisdale Community Centre",
    address: "5851 West Blvd, Vancouver, BC",
    startAt: new Date("2026-04-15T09:00:00-07:00"),
    endAt: new Date("2026-04-15T16:00:00-07:00"),
    formVersionId: ID.formHealthFairV1,
    campaignTags: ["community", "spring-2026"],
    requiredConsents: [
      { versionId: ID.consentContactV1, required: true, displayOrder: 1 },
      { versionId: ID.consentTreatmentV1, required: true, displayOrder: 2 },
    ],
  });

  await upsertEvent({
    id: ID.eventEmployer,
    name: "TechCorp Employer Benefits Day",
    eventType: "corporate_event",
    locationName: "TechCorp HQ",
    address: "1055 W Georgia St, Vancouver, BC",
    startAt: new Date("2026-04-22T11:00:00-07:00"),
    endAt: new Date("2026-04-22T15:00:00-07:00"),
    formVersionId: ID.formEmployerV1,
    campaignTags: ["corporate", "benefits-2026"],
    requiredConsents: [
      { versionId: ID.consentContactV1, required: true, displayOrder: 1 },
    ],
  });

  // ---------- Leads ----------
  // Each event gets 4 leads spread across statuses. Indexes 1..4 keep IDs stable.
  // Status semantics:
  //   submitted    — fresh, not yet triaged
  //   needs_review — flagged because a duplicate candidate exists
  //   ready        — triaged, all required consents granted, nothing blocking
  //   synced       — approved, EHR sync succeeded (EhrPatientRef present)
  const leadPlans: LeadPlan[] = [
    leadPlan(ID.eventMarathon, ID.formMarathonV1, 1, "1", "submitted",    ["Jamie",  "Chen"],    "jamie.chen@example.com",   "+16045550101", "Knee pain",         "Half marathon",   [ID.consentContactV1]),
    leadPlan(ID.eventMarathon, ID.formMarathonV1, 2, "1", "needs_review", ["Alex",   "Rivera"],  "alex.rivera@example.com",  "+16045550102", "Lower back pain",   "Marathon",        [ID.consentContactV1, ID.consentMarketingV1], { duplicate: true }),
    leadPlan(ID.eventMarathon, ID.formMarathonV1, 3, "1", "ready",        ["Morgan", "Lee"],     "morgan.lee@example.com",   "+16045550103", "Shoulder pain",     "10K",             [ID.consentContactV1, ID.consentMarketingV1]),
    leadPlan(ID.eventMarathon, ID.formMarathonV1, 4, "1", "synced",       ["Taylor", "Kim"],     "taylor.kim@example.com",   "+16045550104", "Other",             "5K",              [ID.consentContactV1], { ehrPatientId: "jane_pt_001" }),

    leadPlan(ID.eventHealthFair, ID.formHealthFairV1, 1, "2", "submitted",    ["Riley",  "Patel"], "riley.patel@example.com",  "+16045550201", "Neck / posture",  undefined, [ID.consentContactV1, ID.consentTreatmentV1]),
    leadPlan(ID.eventHealthFair, ID.formHealthFairV1, 2, "2", "needs_review", ["Jordan", "Singh"], "jordan.singh@example.com", "+16045550202", "Lower back pain", undefined, [ID.consentContactV1, ID.consentTreatmentV1], { duplicate: true }),
    leadPlan(ID.eventHealthFair, ID.formHealthFairV1, 3, "2", "ready",        ["Casey",  "Brown"], "casey.brown@example.com",  "+16045550203", "Knee pain",       undefined, [ID.consentContactV1, ID.consentTreatmentV1]),
    leadPlan(ID.eventHealthFair, ID.formHealthFairV1, 4, "2", "synced",       ["Sam",    "Nguyen"],"sam.nguyen@example.com",   "+16045550204", "Shoulder pain",   undefined, [ID.consentContactV1, ID.consentTreatmentV1], { ehrPatientId: "jane_pt_002" }),

    leadPlan(ID.eventEmployer, ID.formEmployerV1, 1, "3", "submitted",    ["Drew",   "Cooper"], "drew.cooper@example.com",  "+16045550301", "Lower back pain", undefined, [ID.consentContactV1], { employer: "TechCorp" }),
    leadPlan(ID.eventEmployer, ID.formEmployerV1, 2, "3", "needs_review", ["Quinn",  "Foster"], "quinn.foster@example.com", "+16045550302", "Neck / posture",  undefined, [ID.consentContactV1], { employer: "TechCorp", duplicate: true }),
    leadPlan(ID.eventEmployer, ID.formEmployerV1, 3, "3", "ready",        ["Avery",  "Wong"],   "avery.wong@example.com",   "+16045550303", "Knee pain",       undefined, [ID.consentContactV1], { employer: "TechCorp" }),
    leadPlan(ID.eventEmployer, ID.formEmployerV1, 4, "3", "synced",       ["Skyler", "Davis"],  "skyler.davis@example.com", "+16045550304", "Shoulder pain",   undefined, [ID.consentContactV1], { employer: "TechCorp", ehrPatientId: "jane_pt_003" }),
  ];

  for (const plan of leadPlans) {
    await upsertLead(userId, plan);
  }

  console.warn("Seed complete.");
  console.warn("  Login: admin@demo.com / password123");
  console.warn("  Clinic ID:", ID.clinic);
  console.warn("  Events:    3 active");
  console.warn("  Leads:     12 (mix of submitted / needs_review / ready / synced)");
}

async function upsertFormTemplate(
  templateId: string,
  versionId: string,
  name: string,
  fields: FieldDef[],
): Promise<void> {
  await prisma.formTemplate.upsert({
    where: { id: templateId },
    update: { name },
    create: { id: templateId, clinicId: ID.clinic, name },
  });
  await prisma.formTemplateVersion.upsert({
    where: { id: versionId },
    update: { isPublished: true, publishedAt: new Date("2026-04-01T00:00:00Z") },
    create: {
      id: versionId,
      formTemplateId: templateId,
      versionNumber: 1,
      isPublished: true,
      publishedAt: new Date("2026-04-01T00:00:00Z"),
    },
  });

  // Drop any stale fields from older seed runs that used a different key convention
  // (e.g. camelCase `firstName` before snake_case `first_name`). Their lead field
  // values go with them so no FK orphans are left behind.
  const expectedKeys = fields.map((f) => f.key);
  const staleFields = await prisma.formField.findMany({
    where: { formTemplateVersionId: versionId, key: { notIn: expectedKeys } },
    select: { id: true },
  });
  if (staleFields.length > 0) {
    const staleIds = staleFields.map((f) => f.id);
    await prisma.leadFieldValue.deleteMany({ where: { formFieldId: { in: staleIds } } });
    await prisma.formField.deleteMany({ where: { id: { in: staleIds } } });
  }

  for (const [i, f] of fields.entries()) {
    const data = {
      label: f.label,
      type: f.type,
      required: f.required,
      helpText: f.helpText ?? null,
      placeholder: f.placeholder ?? null,
      options: f.options ? JSON.stringify(f.options) : null,
      piiCategory: f.piiCategory,
      ehrFieldPath: f.ehrFieldPath ?? null,
      displayOrder: i + 1,
    };
    await prisma.formField.upsert({
      where: { formTemplateVersionId_key: { formTemplateVersionId: versionId, key: f.key } },
      update: data,
      create: {
        formTemplateVersionId: versionId,
        key: f.key,
        ...data,
      },
    });
  }
}

async function upsertConsentTemplate(
  userId: string,
  templateId: string,
  versionId: string,
  name: string,
  consentType: string,
  shortLabel: string,
  bodyText: string,
): Promise<void> {
  await prisma.consentTemplate.upsert({
    where: { id: templateId },
    update: { name },
    create: {
      id: templateId,
      clinicId: ID.clinic,
      name,
      consentType,
      createdBy: userId,
    },
  });
  await prisma.consentTemplateVersion.upsert({
    where: { id: versionId },
    update: { bodyText, shortLabel },
    create: {
      id: versionId,
      consentTemplateId: templateId,
      versionNumber: 1,
      bodyText,
      shortLabel,
      effectiveFrom: new Date("2026-04-01T00:00:00Z"),
      createdBy: userId,
    },
  });
}

interface EventInput {
  id: string;
  name: string;
  eventType: string;
  locationName: string;
  address: string;
  startAt: Date;
  endAt: Date;
  formVersionId: string;
  campaignTags: string[];
  requiredConsents: Array<{ versionId: string; required: boolean; displayOrder: number }>;
}

async function upsertEvent(e: EventInput): Promise<void> {
  await prisma.event.upsert({
    where: { id: e.id },
    update: {
      name: e.name,
      eventType: e.eventType,
      locationName: e.locationName,
      address: e.address,
      startAt: e.startAt,
      endAt: e.endAt,
      defaultFormTemplateVersionId: e.formVersionId,
      campaignTags: JSON.stringify(e.campaignTags),
      status: "active",
    },
    create: {
      id: e.id,
      clinicId: ID.clinic,
      name: e.name,
      eventType: e.eventType,
      locationName: e.locationName,
      address: e.address,
      startAt: e.startAt,
      endAt: e.endAt,
      timezone: "America/Vancouver",
      defaultFormTemplateVersionId: e.formVersionId,
      campaignTags: JSON.stringify(e.campaignTags),
      status: "active",
    },
  });

  for (const req of e.requiredConsents) {
    await prisma.eventConsentRequirement.upsert({
      where: {
        eventId_consentTemplateVersionId: {
          eventId: e.id,
          consentTemplateVersionId: req.versionId,
        },
      },
      update: { required: req.required, displayOrder: req.displayOrder },
      create: {
        eventId: e.id,
        consentTemplateVersionId: req.versionId,
        required: req.required,
        displayOrder: req.displayOrder,
      },
    });
  }
}

interface LeadPlan {
  id: string;
  eventDigit: string;
  idx: number;
  eventId: string;
  formVersionId: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  primaryConcern: string;
  raceDistance?: string | undefined;
  employer?: string | undefined;
  consentVersionIds: string[];
  duplicate: boolean;
  ehrPatientId?: string | undefined;
}

function leadPlan(
  eventId: string,
  formVersionId: string,
  idx: number,
  eventDigit: string,
  status: string,
  name: [string, string],
  email: string,
  phone: string,
  primaryConcern: string,
  raceDistance: string | undefined,
  consentVersionIds: string[],
  extra: { duplicate?: boolean; ehrPatientId?: string; employer?: string } = {},
): LeadPlan {
  return {
    id: `66660000-0000-${eventDigit}000-0000-${String(idx).padStart(12, "0")}`,
    eventDigit,
    idx,
    eventId,
    formVersionId,
    status,
    firstName: name[0],
    lastName: name[1],
    email,
    phone,
    primaryConcern,
    raceDistance,
    employer: extra.employer,
    consentVersionIds,
    duplicate: extra.duplicate ?? false,
    ehrPatientId: extra.ehrPatientId,
  };
}

async function upsertLead(userId: string, p: LeadPlan): Promise<void> {
  const isApproved = p.status === "synced" || p.status === "ready";
  const fields = await prisma.formField.findMany({
    where: { formTemplateVersionId: p.formVersionId },
  });
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  await prisma.lead.upsert({
    where: { id: p.id },
    update: {
      status: p.status,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      approvedBy: isApproved ? userId : null,
      approvedAt: isApproved ? new Date("2026-04-19T18:00:00Z") : null,
    },
    create: {
      id: p.id,
      eventId: p.eventId,
      formTemplateVersionId: p.formVersionId,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      source: "extension",
      status: p.status,
      idempotencyKey: `seed-${p.eventDigit}-${p.idx}`,
      createdBy: userId,
      approvedBy: isApproved ? userId : null,
      approvedAt: isApproved ? new Date("2026-04-19T18:00:00Z") : null,
    },
  });

  // Field values for the captured form fields (first_name/last_name/email/phone always
  // present; extra fields depend on the form template). Keys match the snake_case
  // form field keys set above.
  const valueMap: Record<string, string | undefined> = {
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email,
    phone: p.phone,
    primary_concern: p.primaryConcern,
    race_distance: p.raceDistance,
    employer: p.employer,
  };
  for (const [key, value] of Object.entries(valueMap)) {
    if (value === undefined) continue;
    const field = fieldByKey[key];
    if (!field) continue;
    await prisma.leadFieldValue.upsert({
      where: { leadId_formFieldId: { leadId: p.id, formFieldId: field.id } },
      update: { value },
      create: {
        leadId: p.id,
        formFieldId: field.id,
        value,
      },
    });
  }

  // Lead consents (granted records)
  for (const consentVersionId of p.consentVersionIds) {
    await prisma.leadConsent.upsert({
      where: {
        leadId_consentTemplateVersionId: {
          leadId: p.id,
          consentTemplateVersionId: consentVersionId,
        },
      },
      update: { granted: true },
      create: {
        leadId: p.id,
        consentTemplateVersionId: consentVersionId,
        granted: true,
        rawCheckboxValue: true,
        capturedAt: new Date("2026-04-19T17:30:00Z"),
        capturedBy: userId,
      },
    });
  }

  // Optional duplicate candidate (drives needs_review status)
  if (p.duplicate) {
    const dupId = `99990000-0000-${p.eventDigit}000-0000-${String(p.idx).padStart(12, "0")}`;
    await prisma.duplicateCandidate.upsert({
      where: { id: dupId },
      update: {},
      create: {
        id: dupId,
        leadId: p.id,
        candidateType: "ehr_patient",
        candidateRef: `jane_pt_existing_${p.eventDigit}${p.idx}`,
        matchReason: JSON.stringify(["email_exact", "phone_normalized"]),
        matchScore: 0.87,
        status: "pending",
      },
    });
  }

  // Optional EHR patient ref (for synced leads). leadId is uniquely indexed.
  if (p.ehrPatientId) {
    await prisma.ehrPatientRef.upsert({
      where: { leadId: p.id },
      update: { ehrPatientId: p.ehrPatientId },
      create: {
        leadId: p.id,
        ehrProvider: "jane",
        ehrPatientId: p.ehrPatientId,
      },
    });
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
