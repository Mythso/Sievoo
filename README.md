# Sievoo — The Intelligent Quality Sieve for Investors

> **DCF valuation engine · Portfolio allocation formula · Watchlist with automated weekly valuations · FIRE calculator · Investment community feed · Educational academy**

Sievoo is a full-stack financial SaaS platform built for serious, numbers-driven investors. It stress-tests stocks through a rigorous DCF methodology, applies a master allocation formula, keeps a watchlist of followed companies up to date automatically, and hosts a public community where investors share fully transparent analyses — no narratives, only math.

---

## Features

### Valuation Engine (DCF Calculator)
- 5-step tabbed workflow: WACC → FCF projections → Terminal Value → Equity per share → Quality Gates
- **CAPM/WACC** computation with real-time output
- **Three scenarios** (Bear / Base / Bull) computed simultaneously — growth haircut + WACC stress applied automatically
- **Terminal value** via Perpetuity Growth Model or EBITDA Exit Multiple
- **Ticker & company name shown directly on the output card**, with company name auto-filled as soon as a ticker is typed; both persist through fork/save/load and follow the analysis when published
- **4 Quality Gates** — two auto-detected from inputs, two require research:
  - *No BS Rule* (auto): positive rev growth, positive FCF margin, cash > debt (2/3 needed)
  - *Downside Protection* (auto): current price < Bear DCF
  - *Identifiable Moat* (manual): network effects, switching costs, cost advantage, intangibles
  - *Skin In The Game* (manual): founder-led or meaningful open-market insider buying ($100k+ threshold)
- **Master Formula**: `W_final = Gates × max(5%, min(10%, score / Beta × 0.22))`
- Directives: `HOLD + ADD` / `HOLD + TRIM` / `ON TARGET` / `EXCLUSION / EXIT`
- HTML5 Canvas share card export (PNG)
- Save/load analyses as JSON, publish to community feed

### Watchlist
- Admin picks tickers to follow; a scheduled weekly job keeps each one up to date automatically
- Per run: fetches current price and fundamentals (revenue, revenue growth, FCF margin, beta, cash, debt, shares outstanding), then computes a fresh Bear/Base/Bull DCF using the same math as the manual calculator
- **Company name auto-fill**: type a ticker in the admin form and the company name is looked up and filled in automatically (still editable) — the server also fills it in if the request omits it
- **Insider score (0–100)**: derived from recent insider buying/selling activity for the ticker; 50 = neutral, higher = net insider buying. Falls back to neutral when no insider data is available for a given ticker rather than failing the run
- Each company's DCF assumptions (risk-free rate, market return, cost of debt, tax rate, terminal growth, cushion, projection years) are individually configurable, with sensible defaults
- One bad ticker never blocks the rest of the run — failures are isolated and logged per company
- Optional **auto-publish**: keeps a single community analysis card per company up to date in place (no duplicate posts) so visitors always see the latest numbers without manual work
- Manual "Refresh now" trigger available from the admin panel for on-demand runs

### Community Feed
- Browse published analyses sorted by newest / most liked / highest margin of safety
- Ticker search, like analyses, post comments
- Fork any analysis directly into the calculator

### Portfolio Dashboard
- Holdings table: Actual Wt % vs Target Wt % (W_final from the formula)
- Live directives per position
- Double-Down Opportunities: HOLD+ADD positions 20%+ below 52W high → 3× DCA protocol
- Dry powder tracking, Sunday Rebalance Protocol
- Export to JSON

### FIRE Calculator
- 25× expenses rule, 4% withdrawal simulation
- Rule of 110 asset allocation
- Gap-to-target and estimated completion year

### Academy
- Four SEO-optimised educational articles: DCF Fundamentals, Core-Satellite Strategy, The 4% Rule, Moats & Rule of 40

### Admin Console
- Password-protected at `/admin` (not linked anywhere in the UI)
- Manage contact form inbox, change admin password
- Manage the watchlist: add/remove companies, view latest valuation + insider activity per company, toggle auto-publish, trigger manual refreshes
- SHA-256 + salt hashing, session token stored in DB

### Internationalisation
- EN / NO language toggle, stored in `localStorage`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 7, TypeScript 5.9 |
| **Styling** | Tailwind CSS v4, shadcn/ui (Radix UI) |
| **Routing** | Wouter |
| **Data fetching** | TanStack React Query |
| **Backend** | Express 5, Node.js 24, TypeScript |
| **Database** | PostgreSQL (Drizzle ORM) |
| **Validation** | Zod v4 |
| **API contract** | OpenAPI 3.1 spec → Orval codegen (hooks + Zod schemas) |
| **Logger** | Pino + pino-http |
| **Package manager** | pnpm workspaces (monorepo) |

---

## Monorepo Structure

```
/
├── artifacts/
│   ├── sievoo/                    # React frontend  (@workspace/sievoo)
│   │   ├── src/
│   │   │   ├── pages/        # Home, Calculator, FIRE, Portfolio, Academy, Admin, Contact …
│   │   │   ├── components/   # SievooLogo, AnalysisCard, Navbar, Footer …
│   │   │   └── hooks/
│   │   └── index.html        # Analytics tag lives here
│   ├── api-server/                # Express API     (@workspace/api-server)
│   │   └── src/
│   │       ├── routes/       # analyses, comments, contact, admin, watchlist, ticker
│   │       ├── lib/          # market-data (price/fundamentals/insider fetch), valuation (DCF math), watchlist-job
│   │       └── watchlist-worker.ts   # standalone entrypoint for the scheduled watchlist job
│   └── mockup-sandbox/            # Internal component preview server
├── lib/
│   ├── api-spec/              # openapi.yaml  → single source of truth for API contracts
│   ├── api-client-react/      # Orval-generated React Query hooks (do not edit manually)
│   ├── api-zod/                # Orval-generated Zod schemas   (do not edit manually)
│   │   └── watchlist.ts       # hand-written watchlist schemas (kept outside src/generated)
│   └── db/                        # Drizzle ORM schema + connection
│       └── src/schema/
│           ├── analyses.ts
│           ├── comments.ts
│           ├── contact_messages.ts
│           ├── admin_config.ts
│           └── watchlist.ts   # watchlist_companies + watchlist_valuations
├── scripts/                       # Post-merge setup scripts
├── package.json                   # Monorepo root
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Brand & Design

| Token | Value | Use |
|---|---|---|
| Background | `#0b0f19` | Deep charcoal base |
| Card | `#1e293b` | Dark slate surfaces |
| Primary / Gold | `#f59e0b` | CTA, highlights |
| Accent / Emerald | `#10b981` | Positive signals, HOLD+ADD |
| Destructive / Rose | `#f43f5e` | Warnings, EXCLUSION |

Dark mode only, monospace font for all financial figures.

---

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm 9+
- PostgreSQL database (connection string in `DATABASE_URL`)

### Install

```bash
git clone https://github.com/Mythso/Sievoo.git
cd sievoo
pnpm install
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for session signing |
| `NODE_ENV` | — | `development` \| `production` |
| `PORT` | — | Port for the API server |
| `RAILPACK_INSTALL_CMD` | — | Install override (`pnpm install --no-frozen-lockfile`) to avoid lockfile mismatches on deploy |

### Database Setup

```bash
pnpm --filter @workspace/db run push
```

### Run in Development

```bash
# Frontend (http://localhost:<PORT>)
pnpm --filter @workspace/sievoo run dev

# API server (http://localhost:8080)
pnpm --filter @workspace/api-server run dev
```

### Build

```bash
pnpm run build   # typecheck + build all packages
```

### Regenerate API Client (after openapi.yaml changes)

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## API Overview

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analyses` | List community analyses (sort, search, pagination) |
| `POST` | `/api/analyses` | Publish a new analysis |
| `GET` | `/api/analyses/:id` | Get single analysis |
| `POST` | `/api/analyses/:id/like` | Like an analysis |
| `GET` | `/api/analyses/stats` | Community statistics |
| `GET` | `/api/analyses/:id/comments` | List comments |
| `POST` | `/api/analyses/:id/comments` | Post a comment |
| `GET` | `/api/watchlist` | List followed companies with their latest valuation |
| `POST` | `/api/admin/watchlist` | Add a company to the watchlist (auth required) |
| `DELETE` | `/api/admin/watchlist/:id` | Remove a company from the watchlist (auth required) |
| `POST` | `/api/admin/watchlist/refresh` | Manually trigger a watchlist refresh run (auth required) |
| `GET` | `/api/ticker-lookup` | Look up a company name from a ticker (public, used for auto-fill) |
| `POST` | `/api/contact` | Submit contact form (rate-limited: 5 req/hr per IP) |
| `POST` | `/api/admin/auth` | Admin login (rate-limited: 10 attempts/15 min) |
| `GET` | `/api/admin/messages` | List contact messages (auth required) |
| `PATCH` | `/api/admin/messages/:id` | Mark message read (auth required) |
| `POST` | `/api/admin/change-password` | Change admin password (auth required) |
| `GET` | `/ads.txt` | Google AdSense ads.txt |

Admin endpoints require the `x-admin-token` header. Default admin password on first run: `AdminPass123!` — **change immediately after deployment.**

---

## Key Architecture Decisions

- **All manual DCF math is client-side.** The API mainly handles persistence (community feed, admin, contact) and the watchlist's server-side valuation runs. No server round-trips for the interactive calculator itself.
- **Contract-first API.** `lib/api-spec/openapi.yaml` is the single source of truth for the core CRUD endpoints. Always edit the spec first, then run codegen before touching frontend or backend code. The watchlist endpoints currently ship as hand-written Zod schemas (`lib/api-zod/watchlist.ts`) pending a spec update.
- **`type: number` in the OpenAPI spec**, not `type: integer` — Orval generates `zod.int()` for integers, which does not exist in Zod v3/v4.
- **In-memory rate limiting** (per process). Suitable for single-instance deployment; swap for Redis if multi-instance scaling is needed.
- **Admin auth** uses SHA-256 + static salt for password hashing and a random session token stored in the DB, passed via the `x-admin-token` header.
- **Watchlist data source**: current price, fundamentals, and insider activity are fetched from a public, no-API-key market data feed. Since this feed is unofficial, per-ticker failures are caught and logged individually rather than failing the whole run, and insider data falls back to a neutral score when unavailable for a given ticker.
- **Cron worker env vars**: `watchlist-worker` runs on a schedule rather than continuously, and reference variables (e.g. `DATABASE_URL` pointing at `${{Postgres.DATABASE_URL}}`) only resolve reliably starting from the deployment where they were set — setting a variable on the service is not enough by itself, it also needs a redeploy (not just a scheduled cron run) to take effect.

---

## Deployment

The project runs as two always-on services plus one scheduled job, all deployed from this monorepo:

1. **`sievoo-web`** — builds and serves the frontend (`pnpm --filter @workspace/sievoo run build`)
2. **`api-server`** — builds and runs the Express API (`pnpm --filter @workspace/api-server run build` / `run start`), with `pnpm --filter @workspace/db run push-force` applied as a pre-deploy step so schema changes roll out automatically
3. **`watchlist-worker`** — same codebase as `api-server`, deployed as a separate service with its own entrypoint (`run start:watchlist-worker`) and a weekly cron schedule instead of a continuous process

For other platforms:

1. Build: `pnpm run build`
2. Serve the API: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
3. Serve the frontend: build output in `artifacts/sievoo/dist/` — serve as static files behind the same domain or a CDN
4. Run the watchlist job on a schedule: `node --enable-source-maps artifacts/api-server/dist/watchlist-worker.mjs`

---

## License

MIT
