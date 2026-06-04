# SMART CLINIC

A multi-clinic healthcare SaaS web app with role-based dashboards, patient management, live queue, appointments, staff management, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (uses PGHOST/native PG in dev)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Recharts, TanStack Query, Wouter
- API: Express 5, JWT auth (SESSION_SECRET), bcrypt password hashing
- DB: PostgreSQL (Replit native) + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — source of truth for all DB table definitions
- `lib/api-spec/openapi.yaml` — API contract (OpenAPI 3.0), run codegen after changes
- `lib/api-client-react/src/generated/` — generated React Query hooks & Zod schemas (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, clinics, patients, queues, appointments, analytics)
- `artifacts/smart-clinic/src/pages/` — React pages for the frontend
- `artifacts/smart-clinic/src/contexts/AuthContext.tsx` — JWT token storage + user/clinic membership state

## Architecture decisions

- **Contract-first API**: OpenAPI spec drives both server validation and client hooks via Orval codegen. Never skip codegen after spec changes.
- **DB connection priority**: `lib/db/src/index.ts` prefers `PGHOST`/`PGUSER`/etc. (Replit native PG) over `DATABASE_URL`. This means a user-set Supabase `DATABASE_URL` secret does NOT override the native PG in development.
- **JWT auth**: tokens stored in `localStorage` under `"token"`, verified by `SESSION_SECRET` env var on the server.
- **Clinic membership model**: users belong to clinics via `clinic_members` table; join requests go through admin approval before membership is granted.
- **Role hierarchy**: `clinic_admin` > `doctor` > `nurse` > `receptionist` > `patient`.

## Product

- Registration & login with JWT auth
- Clinic creation (admin) and join-by-code flow with admin approval
- Role-based sidebar navigation (dashboard, queue, patients, appointments, staff, settings)
- Live queue management with real-time status updates
- Patient registry with search and profile pages
- Appointment booking and cancellation
- Analytics dashboard with charts (queue trends, activity feed, stats cards)
- Staff management: role changes, join request approval/rejection

## User preferences

- Supabase credentials are stored as secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL). The DATABASE_URL may point to a paused Supabase project — the app falls back to Replit-native PostgreSQL via PGHOST env vars automatically.

## Gotchas

- **Supabase paused**: If the Supabase project is paused (free tier auto-pauses after 1 week inactivity), DATABASE_URL will fail. The app uses PGHOST/native PG as the primary connection — this is intentional.
- **drizzle-kit push**: Must be run with PGHOST set (which Replit provides). The `drizzle.config.ts` auto-builds the URL from PG* vars when PGHOST is present.
- **Mutation patterns**: Orval-generated mutations take flat args — `mutateAsync({ clinicId, data })` not `mutateAsync({ params: { clinicId }, data })`.
- **Query hooks**: All query hooks require a `queryKey` field in the `query` option object.
- **API server port**: The server binds to `PORT` env var (8080 in dev), exposed via the shared proxy at `/api`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
