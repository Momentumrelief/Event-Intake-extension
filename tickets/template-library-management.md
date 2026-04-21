# Ticket: Template Library Management

Status: open
Type: feature
Priority: P1
Owner: unassigned
Created: 2026-04-21

## Context

Clinic operators need a dedicated template area outside the event flow. They should be able to create reusable intake templates, choose existing templates for events, and modify templates through versioned updates.

## Acceptance Criteria

- Admin can view a library of existing intake templates for the clinic.
- Admin can create a new template from scratch.
- Admin can duplicate an existing template as a starting point.
- Admin can edit template fields, labels, field types, required flags, help text, placeholders, options, and display order.
- Admin can choose from supported field types: short text, long text, phone, email, address, date, date of birth, single select, multi select, checkbox, consent checkbox, and number.
- Admin can preview a template as potential clients will see it.
- Editing a template that has already been used by submitted leads creates a new template version instead of mutating the historical version.
- Admin can mark templates active/inactive so event setup only promotes usable templates.
- Template detail shows which events use each template version.

## Notes

- This should share the same controlled form-builder behavior used by event setup.
- Avoid arbitrary HTML, scripts, or custom JSON logic in templates.
