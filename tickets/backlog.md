# Backlog

Deferred work and open decisions that should not be lost between sessions.

## Open

### Jane Developer Platform Access

Status: open  
Type: research  
Priority: P1  
Created: 2026-04-20

Context: Confirm whether partner access is available and which Jane scopes/endpoints are approved for this use case.

Acceptance criteria:

- Jane access path is documented in `docs/architecture.md`.
- MVP integration approach is recorded as `official_api`, `manual_export_first`, or `hybrid` in `docs/implementation-plan.md`.

### Compliance And PHI Assumptions

Status: open  
Type: decision  
Priority: P1  
Created: 2026-04-20

Context: Event leads may include health concerns, treatment requests, or other PHI-like data depending on the configured form fields.

Acceptance criteria:

- Compliance assumptions are documented in `docs/architecture.md`.
- Required consent types are documented in `docs/implementation-plan.md`.

### First Event Presets

Status: open  
Type: feature  
Priority: P2  
Created: 2026-04-20

Context: The implementation plan calls for initial event presets such as marathon, medical conference, and health fair.

Acceptance criteria:

- First event presets are defined.
- Required fields and consents are specified for each preset.

### Close Procedure Git Setup

Status: open  
Type: chore  
Priority: P2  
Created: 2026-04-20

Context: The workspace currently does not appear to be a Git repository, so agents cannot commit or push from this directory.

Acceptance criteria:

- Repository is initialized or connected to the intended remote.
- Close procedure can complete commit and push steps when appropriate.
