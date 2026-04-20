# Ticket: Seed Demo Event Workflow

Status: open
Type: feature
Priority: P1
Owner: unassigned
Created: 2026-04-20

## Context

The dashboard, review queue, backend, and extension skeletons exist, but the seeded database currently only creates the demo user and clinic. After login, the dashboard has no real operational data, the review queue is empty, and event management has no active events to work with.

The next useful milestone is a realistic demo workflow that makes the current UI meaningful and gives the next builder concrete data to test against.

## Goal

Seed a complete, realistic event intake scenario so the admin dashboard and review queue show useful data immediately after setup.

## Acceptance Criteria

- `pnpm.cmd --filter api db:seed` can be rerun safely without duplicating data.
- Seed creates or updates the demo admin user:
  - Email: `admin@demo.com`
  - Password: `password123`
- Seed creates or updates the demo clinic:
  - Name: `Westside Physiotherapy`
- Seed creates at least three events:
  - Marathon or race expo
  - Health fair
  - Employer benefits day
- Each event has a versioned form template with realistic fields.
- Seed creates contact, marketing, and treatment consent templates with current versions.
- Seed links required consent versions to events.
- Seed creates at least 10 realistic leads across multiple statuses:
  - `submitted`
  - `needs_review`
  - `ready`
  - `synced`
- At least one lead has a duplicate candidate record.
- At least one lead has captured consent records.
- Review queue shows realistic rows after seed.
- Dashboard metrics can be computed from the seeded data.

## Suggested Implementation Notes

- Update `apps/api/src/seed.ts`.
- Prefer fixed IDs or stable unique keys so the seed is idempotent.
- Keep sample data obviously fake.
- Include a mix of complete and incomplete contact data.
- Include at least one health-related intake field to exercise PHI/compliance handling assumptions.
- Avoid committing generated local database files.

## Related Files

- `apps/api/src/seed.ts`
- `apps/api/prisma/schema.prisma`
- `apps/web/src/App.tsx`
- `apps/web/src/pages/ReviewQueuePage.tsx`
- `docs/implementation-plan.md`
- `tickets/backlog.md`
