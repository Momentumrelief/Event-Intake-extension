# Event Intake

A monorepo for collecting patient leads at health events — Chrome extension for booth staff, web admin for clinic operators, and a Fastify API backend with SQLite.

## Repository Layout

```
eventintake/
├── apps/
│   ├── api/          Fastify API (TypeScript, Prisma + SQLite)
│   ├── web/          React admin portal (Vite, React Router v6)
│   └── extension/    Chrome MV3 extension (popup + background worker)
├── packages/
│   └── shared/       Zod schemas shared between API and extension
├── docs/             Architecture, implementation plan, close procedure
├── sessions/         Per-session handoff notes
├── tickets/          Backlog and issue tracking
├── AGENTS.md         Agent instructions (read before any AI session)
└── CLAUDE.md         Claude-specific agent config
```

## Prerequisites

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- No Docker required — database is SQLite (file-based)

## Quick Start

```bash
# 1. Install all dependencies
pnpm install

# 2. Generate Prisma client and create the database
cd apps/api
npx prisma migrate deploy   # or: npx prisma db push (first time)
npx prisma generate

# 3. Seed demo data (creates admin@demo.com / password123)
npx tsx src/seed.ts

# 4. Start the API (from the repo root, any shell)
pnpm --filter api dev

# 5. Start the web admin (new terminal, from the repo root)
pnpm --filter web dev
```

> **PowerShell caveat:** if PowerShell blocks `pnpm.ps1` with an execution-policy
> error, run the same commands from `cmd.exe` or Git Bash, or unblock pnpm for
> the current user once with
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Open http://localhost:5173 and log in with `admin@demo.com` / `password123`.

## Demo Credentials

| Field    | Value                  |
|----------|------------------------|
| Email    | admin@demo.com         |
| Password | password123            |
| Clinic   | Westside Physiotherapy |

## Environment Variables

`apps/api/.env` (required — Prisma CLI reads from this directory):

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="dev-secret-do-not-use-in-production-32chars"
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379   # optional — EHR sync disabled if unavailable
```

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Returns JWT access token |
| GET | `/auth/me` | Current user info |
| GET | `/events` | List events for a clinic |
| POST | `/leads` | Submit a lead (from extension) |
| GET | `/clinics/:id/review-queue` | Leads awaiting review |
| POST | `/leads/:id/approve` | Approve lead for EHR sync |
| POST | `/leads/:id/reject` | Reject lead |

## Development Notes

- Redis is optional — if unavailable, EHR sync worker is silently disabled. All other features work.
- SQLite database file: `apps/api/prisma/dev.db` (gitignored).
- JSON arrays (e.g., `campaignTags`) are stored as serialized strings in SQLite and parsed on read.

## Further Reading

- `docs/architecture.md` — system design, data model, integration strategy
- `docs/implementation-plan.md` — phase scope and acceptance criteria
- `tickets/backlog.md` — open work items
