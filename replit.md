# Sievoo

The Intelligent Quality Sieve & Valuation Engine for Investors. A full-stack financial SaaS platform featuring a DCF valuation calculator, portfolio allocation engine, FIRE/pension calculator, public investment community feed, and educational academy.

## Run & Operate

- `pnpm --filter @workspace/sievoo run dev` — run the React frontend (managed by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (managed by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- Admin default password: `AdminPass123!` (change via /admin after first login)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark mode, Sievoo brand palette)
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec/openapi.yaml)

## Brand Colors

- Background: #0b0f19 (Deep Charcoal)
- Card: #1e293b (Dark Slate)
- Primary/Gold: #f59e0b (Sieve Gold)
- Accent/Emerald: #10b981 (Growth)
- Destructive/Rose: #f43f5e (Crisis)

## Where things live

- `artifacts/sievoo/src/pages/` — all page components (Home, Calculator, FIRE, Portfolio, Academy, Admin, Contact, legal pages)
- `artifacts/sievoo/src/components/` — shared components (SievooLogo, AnalysisCard, Navbar, Footer, etc.)
- `artifacts/api-server/src/routes/` — Express route handlers (analyses, comments, contact, admin)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle DB schema (analyses, comments, contact_messages, admin_config)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit manually)

## Key Features

- **DCF Calculator** (/calculator): Full 4-step WACC/CAPM + FCF + Terminal Value + Equity per share. 3 scenarios (Bear/Base/Bull). Binary quality gates (B_NoBS, B_Moat, B_CEO, B_DCFBear). Master Formula: W_final = gates * max(5%, min(10%, weighted score / Beta * 0.22)). HTML5 Canvas share card generator. Publish to community. Download/upload JSON reports.
- **Community Feed** (/): Published analyses with sorting, ticker search, likes, comments, fork-to-calculator.
- **FIRE Calculator** (/fire): 25x rule, 4% withdrawal, Rule of 110 asset allocation, gap + completion year.
- **Portfolio Dashboard** (/portfolio): Decision matrix with HOLD+ADD / HOLD+TRIM / ON TARGET directives.
- **Academy** (/academy): 4 SEO-optimized educational articles.
- **Admin** (/admin): Password-protected console. Default password: AdminPass123!
- **Localization**: EN/NO toggle stored in localStorage.
- **ads.txt**: Served at /ads.txt for Google AdSense.

## Architecture decisions

- All DCF/formula math runs entirely client-side in React state — no server round-trips for calculations.
- Admin auth uses SHA-256 password hashing with a static salt + random session token stored in DB. Tokens passed via `x-admin-token` header.
- Rate limiting is in-memory (per process) — suitable for single-instance deployment. Would need Redis for multi-instance.
- OpenAPI integer fields use `type: number` (not `type: integer`) to avoid Orval generating `zod.int()` which doesn't exist in Zod v3.

## User preferences

_Populate as you build._

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before editing frontend or backend files.
- Use `type: number` (not `type: integer`) in OpenAPI spec — Orval generates `zod.int()` for integers which fails with Zod v3.
- Do not import from `@workspace/api-client-react/src/generated/...` directly — use `@workspace/api-client-react` barrel only.
- Admin endpoints require `x-admin-token` header, not Bearer auth.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
