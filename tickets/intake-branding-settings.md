# Ticket: Intake Questionnaire Branding Settings

Status: open
Type: feature
Priority: P2
Owner: unassigned
Created: 2026-04-21

## Context

Clinic operators need control over what potential clients see when filling out an intake questionnaire. The questionnaire should be brandable with clinic or event-specific identity such as logo, colors, and display text.

## Acceptance Criteria

- Admin can configure intake branding for a clinic and optionally override it per event.
- Admin can upload or select a logo shown on the client-facing intake questionnaire.
- Admin can configure primary color, accent color, background color, and button color.
- Admin can configure questionnaire title and short intro text.
- Admin can preview the branded intake questionnaire before publishing.
- Branding preview uses the selected form template and consent blocks so layout issues are visible.
- Extension/client intake UI applies the selected branding consistently.
- Branding settings have sensible defaults when no custom branding is configured.
- Stored branding assets and settings are scoped by clinic and do not leak across clinics.

## Notes

- Keep accessibility in scope: color choices should preserve readable contrast where practical.
- This ticket is for questionnaire/client-facing branding, not the internal admin portal theme.
