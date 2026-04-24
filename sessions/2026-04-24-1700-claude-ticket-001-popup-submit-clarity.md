# Session: TICKET-001 — Popup submit clarity

Date: 2026-04-24
Agent: Claude

## Objective

User reported that after loading the extension in Chrome (per the 2026-04-23 progress block on TICKET-001), the popup "does not clearly allow submitting a lead." Diagnose the UX issue, fix it without altering the backend contract, rebuild `dist/`, and hand back precise human retest steps.

## Root cause

The popup body was `width: 360px; min-height: 200px;` with no max/explicit height and no flex layout. Chrome popups cap at 600px tall. With the seeded form (6 fields, 2 consent blocks ≈ 140px each, action row), the rendered form runs ~720–800px. Result: the popup itself scrolled, the **Submit Lead** button rendered below the fold, and a first-time user looking at the form had no visible Submit affordance and no top-of-form hint that submit was blocked. There was nothing actually wrong with backend POST `/leads` — the UX simply hid the submit path.

A secondary issue: when "Save Draft" succeeded, the popup reused the red `errorBanner` style to say "Draft saved locally." — which read as a failure.

## Changes Made

The user already had uncommitted edits in `LeadForm.tsx` and `ConsentBlock.tsx` (validation summary, scroll-to-first-error, per-consent error props, conditional spread of optional payload fields). Those were kept as-is and built on. New work in this session:

- `apps/extension/src/popup/index.html`: body is now a fixed-height (`380x600`) flex column with `overflow: hidden`; `#root` is also a flex column with `flex: 1; min-height: 0`. This pins the popup to Chrome's max popup size so internal scrolling stays inside the form, not outside the visible region. Width bumped 360→380 to give the consent body text more room.
- `apps/extension/src/popup/App.tsx`: split the form view from `styles.page` (used by login/event-select/success/error). New `styles.formPage` is a flex column that fills the popup. The header is `flexShrink: 0` so it stays pinned at the top while the form scrolls beneath it.
- `apps/extension/src/popup/components/LeadForm.tsx`:
  - Restructured the form into `styles.scrollArea` (fields + consents, `overflowY: auto`) and `styles.footer` (validation summary + status banner + action buttons, `flexShrink: 0`, top border + soft shadow). The Save Draft / Submit Lead buttons are now **always visible** above the popup fold regardless of how tall the form gets.
  - Submit button label dynamically shows blocked state: "Submit Lead" when ready, "Submit Lead (N missing)" when N required items are still empty, "Submitting…" while the request is in flight. Button background dims to grey while blocked, but stays clickable so a click still runs `validate()` and scrolls to the first invalid control (existing behavior, kept).
  - Validation summary in the footer is now bold + plural-aware ("3 required items left:" / "1 required item left:") and lists every missing field/consent label so a human can read it without scrolling back through the form.
  - Split status state: `submitError` (red) and `infoMessage` (green) are now distinct. "Draft saved locally." renders as a green info banner instead of looking like an error. The error banner only shows for actual errors.
  - Network error path now writes both an info banner ("Offline — lead saved locally…") and a clear submitError ("Could not reach the API at http://localhost:3000. Confirm 'pnpm --filter api dev' is running, then click Submit Lead again."), so the operator knows exactly what to do, and the lead is still preserved in `chrome.storage.local`.
  - Generic submit failures now prefix with "Submit failed: " so the message reads as actionable rather than just echoing the raw error.

## Verification

- `git status --short --branch` before edits: `main...origin/main`, with the user's uncommitted edits to `LeadForm.tsx` and `ConsentBlock.tsx` already present (kept).
- `pnpm --filter extension typecheck`: clean.
- `pnpm --filter extension build`: 37 modules transformed, `dist/popup/popup.js` 161 KB, `dist/popup/index.html` 0.75 KB, service worker emitted. No errors.
- `dist/popup/index.html` contains the new `380x600` flex sizing.
- `dist/popup/popup.js` contains the new strings ("Submit Lead", "Draft saved locally", "API at http") confirming the rebuild captured the source changes.
- Extension API contract re-confirmed against the live API (`pnpm --filter api dev` already running):
  - `POST /auth/login` → JWT for `admin@demo.com`.
  - `GET /clinics/<id>/events?status=active` → 3 events.
  - `GET /form-template-versions/<id>` → 6 fields (`first_name*, last_name*, email*, phone*, race_distance, primary_concern`).
  - `GET /events/<id>/consent-requirements` → 2 (`contact*, marketing`).
  - No backend code was touched in this session.
- Not run from this environment: literal Chrome popup interaction. Handed back as a precise checklist below.

## Human retest steps (Chrome)

1. Confirm `pnpm --filter api dev` is running on port 3000 (the existing background job is still alive, but if you've killed it, restart from the repo root).
2. In Chrome open `chrome://extensions`. The "Event Intake" tile should already be loaded from the prior session — click its **Reload** button (circular arrow). If it isn't loaded, click **Load unpacked** and select `C:\Users\paint\eventintake\apps\extension\dist`.
3. Click the Event Intake toolbar icon. The popup should be **380px wide, 600px tall** (slightly wider than before, fixed height).
4. Sign in with `admin@demo.com` / `password123`, pick **Vancouver Marathon Expo 2026**.
5. **Without filling anything in**, scroll to confirm: the field list scrolls inside the popup, but the white **footer** with "Save Draft" and "Submit Lead (5 missing)" stays pinned at the bottom. The footer should also show an orange banner "5 required items left: First name, Last name, Email, Phone, Contact consent". The Submit Lead button should appear grey-blue (blocked-state colour).
6. Click **Submit Lead** while it's blocked. Expect: the popup auto-scrolls to the first invalid field (First name), the field gets a red border, and the orange validation banner stays visible.
7. Fill in First name, Last name, Email, Phone. Notice the missing-count drops as you type. Leave the **Contact** consent unchecked. The Submit button should now read "Submit Lead (1 missing)" and the consent block should have a red border and "This consent is required to submit." line.
8. Tick the Contact consent checkbox. The Submit button should snap to its blue "Submit Lead" state with no warning banner. Click it.
9. Expect the success screen with a green check, "Lead submitted!", and **no** duplicate warning. Click **Capture Another Lead**.
10. Fill First/Last name with new values, **reuse the same email**, tick the Contact consent, click **Submit Lead**. Expect the success screen with the amber duplicate banner.
11. Bonus: click **Save Draft** with partial data. Expect a **green** info banner "Draft saved locally." (not red).
12. Bonus: stop the API (`pnpm --filter api dev`) and try to submit. Expect a red error banner pointing at `http://localhost:3000` with the exact remediation command, and a green info banner saying the lead was saved locally.

If all 12 pass, mark TICKET-001 `done` in `tickets/backlog.md`.

## Canonical Updates

- `tickets/backlog.md`: appended a 2026-04-24 progress note to TICKET-001 covering this session. Status still `open` until the user confirms steps 1–12 above pass in Chrome.
- `README.md`, `docs/architecture.md`, `docs/implementation-plan.md`, `docs/close-procedure.md`: not changed.

## Deferred Work

- Real branded extension icons (deferred since 2026-04-23, still tracked).
- Pre-existing `pnpm --filter api typecheck` failures under `exactOptionalPropertyTypes` — still tracked by scheduled routine `trig_01W3CN9QgExdDXKJ1iaoNeib` (2026-04-30).
- Add a popup-side automated UI test (Playwright + extension load) — out of scope for this session, would catch the kind of layout regression we just fixed by hand.

## Git State

- Committed: pending at time of writing this note.
- Pushed: pending.
- Uncommitted before this session: `LeadForm.tsx` and `ConsentBlock.tsx` (user edits — kept and built upon, will go out in the same commit).
