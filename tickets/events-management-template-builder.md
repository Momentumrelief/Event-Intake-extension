# Ticket: Events Management And Inline Template Builder

Status: done
Type: feature
Priority: P1
Owner: claude
Created: 2026-04-21
Closed: 2026-04-23
Session: `sessions/2026-04-23-1700-claude-ticket-002-events-management.md`

## Context

Clinic operators need a place in the web admin to create and manage events. While creating an event, they should be able to choose an existing intake template or build a new event-specific template without leaving the event setup flow.

This expands the existing `TICKET-002` events management UI scope.

## Acceptance Criteria

- Admin can list existing events for the current clinic.
- Admin can create a new event with name, event type, dates, location, status, and campaign tags.
- Admin can choose an existing form template during event creation.
- Admin can create a new form template during event creation.
- Admin can build or edit the selected template fields from the event setup flow.
- Admin can preview the intake questionnaire tied to the event before publishing.
- Event detail shows the active form template version and consent requirements.
- Admin can edit, close, deactivate, or archive an event without deleting historical lead context.

## Notes

- Keep form template versions immutable once used by submitted leads.
- Event setup should integrate with consent requirements and future branding settings.
