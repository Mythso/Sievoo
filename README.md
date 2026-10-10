# Sievoo — The Intelligent Quality Sieve for Investors

> **DCF valuation engine · Graham Number & Defensive Investor screen · Portfolio allocation formula · Stock pages with automated DCF + Graham valuations (US + Oslo Børs) · Public track record & analyst leaderboard · Ticker alerts · Investment community with profiles and discussion · FIRE calculator · Bilingual (EN/NO) academy**

Sievoo is a full-stack financial SaaS platform built for serious, numbers-driven investors. It stress-tests stocks through a rigorous DCF methodology, screens them through Benjamin Graham's value-investing criteria, applies a master allocation formula, keeps a watchlist of followed companies up to date automatically (including auto-discovering trending tickers), covers Oslo Børs as well as US stocks, and hosts a public community where investors share fully transparent analyses under their own name and get scored on how those calls actually turned out — no narratives, only math.

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

### Graham Calculator
- **Graham Number** = √(22.5 × EPS × Book Value per Share), with margin-of-safety vs. current price
- **7-point Defensive Investor checklist** (Graham's conservative screen: size, financial strength, earnings stability, dividend record, earnings growth, P/E cap, P/B cap)
- **NCAV net-net screener** for deep-value situations
- Paired with four Academy articles: Margin of Safety, Mr. Market, Defensive vs. Enterprising Investor, and the Graham Number itself

### Watchlist
- Admin picks tickers to follow; a scheduled weekly job (**AutoDCF**) keeps each one up to date automatically. A separate daily job auto-discovers Yahoo Finance's trending US tickers and onboards new ones immediately
- Per run: fetches current price and fundamentals (revenue, revenue growth, FCF margin, beta, cash, debt, shares outstanding, trailing EPS, book value per share), then computes:
  - A fresh Bear/Base/Bull **DCF** (AutoDCF) using the same math as the manual calculator
  - A **Graham Number** (AutoValue) using the same math as the Graham Calculator — nullable when a ticker has no positive trailing EPS or book value
- **Company name auto-fill**: type a ticker in the admin form and the company name is looked up and filled in automatically (still editable) — the server also fills it in if the request omits it
- **Insider score (0–100)**: derived from recent insider buying/selling activity for the ticker; 50 = neutral, higher = net insider buying. Falls back to neutral when no insider data is available for a given ticker rather than failing the run
- Each company's DCF assumptions (risk-free rate, market return, cost of debt, tax rate, terminal growth, cushion, projection years) are individually configurable, with sensible defaults
- One bad ticker never blocks the rest of the run — failures are isolated and logged per company
- Optional **auto-publish**: keeps a single community analysis card per company up to date in place (no duplicate posts), including the latest Graham number in the notes, so visitors always see the latest numbers without manual work
- Manual "Refresh now" trigger available from the admin panel for on-demand runs
- **Valuation history**: every run is stored as its own row rather than overwriting the last one, so price, DCF, and Graham Number can be tracked over years and checked against what actually happened (see Statistics tab below)
- **Public History tab**: the `/watchlist` page's History tab is open to any visitor — pick a followed ticker and see the same price-vs-AutoDCF-vs-AutoValue chart as the admin Statistics tab, backed by a public (unauthenticated) history endpoint

### Stock Pages (`/stocks`, `/stock/:ticker`)
- `/stocks`: every tracked company with its latest price, AutoDCF, Graham Number and both margins of safety; filter by Oslo Børs / US, search and sort
- `/stock/:ticker`: latest numbers (bear/base/bull, Graham), the full price-vs-valuation history chart, every community analysis of that ticker, follow/alert button, share links, and a "Run your own DCF" button that forks the auto-published analysis into the calculator
- Pages are server-rendered for crawlers and link previews (see SEO below), so each ticker can rank for searches like "EQNR intrinsic value"

### Community
- **Accounts own their analyses**: publishing while logged in attributes the analysis to the account's public name (verified badge), lists it on the public profile, lets the owner delete it without a PIN, and counts it on the leaderboard. Anonymous alias + PIN publishing still works
- **Profiles** (`/u/:id`): public name, published analyses, likes, scored calls and leaderboard rank. Emails are never shown. Renaming updates the name on past analyses and comments
- **Analysis pages** (`/analysis/:id`): shareable page per analysis with bear/base/bull, notes, fork button, likes, share links and a discussion thread
- **Comments** require an account (rate-limited to 20/hour per account)
- Feed on the home page: newest / most liked / highest margin of safety, ticker search, comment counts
- Publishing a ticker that isn't tracked yet (while logged in) adds it to the watchlist in the background (source `community`, auto-publish off), so it gets a stock page and price history for scoring. Capped at 25 new tickers/day

### Track Record & Leaderboard (`/track-record`)
- **Method accuracy**: every stored watchlist snapshot is a call (undervalued if the method's value is above that day's price). After 30, 90 and 365 days the price is checked: hit rate, average return when "cheap" vs. "expensive", and how often the price moved toward the value — for AutoDCF and the Graham Number side by side
- **Analyst leaderboard**: account-owned analyses older than 30 days are scored. Positive margin of safety = bullish call. The start price is the watchlist's own recorded price nearest the publish date (never the price the author typed in) and the outcome is the latest recorded price; one call per user/ticker/week; 3 scored calls to be ranked
- Computed in `lib/track-record.ts`, cached for 10 minutes

### Ticker Alerts & Weekly Digest
- Logged-in users follow a ticker with a method (AutoDCF or Graham) and a margin-of-safety threshold; up to 50 follows per account
- After every `watchlist-worker` / `trending-worker` run (and manual refreshes) `runAlertCheck()` emails users whose threshold was crossed. An alert fires once and re-arms only after the margin drops back below the threshold
- The weekly `watchlist-worker` also sends a digest of all followed tickers (opt-out on the Account page or via the email link)
- One-click unsubscribe links (`/api/alerts/unsubscribe`, `/api/alerts/digest-off`) with `List-Unsubscribe` headers; no login needed
- Email is sent through SMTP (`SMTP_URL`, see Environment Variables). Without it, alerts still fire and show on the Account page, and sending is skipped with a log line

### Share Images
- Dynamic 1200×630 PNG Open Graph images per stock (`/api/og/stock/:ticker.png`), analysis (`/api/og/analysis/:id.png`), profile (`/api/og/user/:id.png`) and for `/stocks` and `/track-record`, so shared links show the actual numbers
- Rendered with `@resvg/resvg-js` from SVG using the bundled JetBrains Mono font (`artifacts/api-server/assets/fonts`, SIL Open Font License); cached in memory for an hour

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
- Eight educational articles: DCF Fundamentals, Core-Satellite Strategy, The 4% Rule, Moats & Rule of 40, Margin of Safety, Mr. Market, Defensive vs. Enterprising Investor, and The Graham Number
- All eight are also available in Norwegian at `/no/academy/:slug` (content in `pages/article-content-no.ts`), with `hreflang` alternates between the two languages

### Admin Console
- Password-protected at `/admin` (not linked anywhere in the UI)
- Manage contact form inbox, change admin password
- Manage the watchlist: add/remove companies, view latest valuation + insider activity per company, toggle auto-publish, trigger manual refreshes
- **Statistics tab**: pick a followed company and see a chart of its stock price plotted against every past AutoDCF (Base case) and AutoValue (Graham Number) run, by date — built to be checked back on in a few years to see which valuation method called it right
- scrypt password hashing (random salt), session token stored in DB

### Internationalisation
- EN / NO language toggle shared app-wide through `lib/i18n.tsx` (`useLang()` → `t(en, no)`), stored in `localStorage`; first visit defaults from the browser language
- Norwegian Academy URLs (`/no/academy/...`) switch the UI to Norwegian; the toggle jumps between the two language versions of an article

### Oslo Børs & Currencies
- The daily `trending-worker` also onboards companies from the Oslo Børs coverage list (`lib/oslo-tickers.ts`, 37 large Oslo listings, 6 per run; override with `OSLO_TICKERS`) with a 22% tax rate and a 4% risk-free rate
- Many listings report in a different currency than they trade in (Equinor/Frontline/Hafnia report in USD but trade in NOK, Mowi reports in EUR, ADRs report in their home currency). `fetchMarketData()` converts revenue, cash and debt into the trading currency using Yahoo FX quotes before the DCF runs, and pence quotes (GBp) are converted to GBP. Every valuation row and auto-published analysis stores its `currency`, and the UI formats amounts accordingly (`$`, `kr`, `€` …)

### SEO
- **Server-rendered dynamic pages**: `vite-plugin-seo.ts` hooks into the `vite preview` server that `sievoo-web` runs in production. For `/stocks`, `/stock/:ticker`, `/analysis/:id`, `/u/:id` and `/track-record` it calls `GET /api/seo/render` and injects the page's title, description, canonical URL, share image and a plain-HTML version of the content into `index.html` (unknown tickers get a real 404 + `noindex`). React replaces the injected content when it boots, and `SeoHead` leaves the server's tags alone on that first load (`sievoo-ssr-path` marker). Fails open to the normal SPA shell if the API is slow
- **Sitemap**: the static pages are collected at build time by `vite-plugin-sitemap.ts` from the routes in `App.tsx` and the Academy articles in `pages/Article.tsx` / `pages/article-content-no.ts` (`/admin`, `/account` and parameterised routes are skipped). At runtime `/sitemap.xml` is served by `vite-plugin-seo.ts`, which merges those with every tracked stock, analysis and active profile from `GET /api/seo/sitemap` (cached 15 minutes). It is referenced from `robots.txt`
- `src/components/SeoHead.tsx` sets title, meta description, canonical URL, robots and Open Graph/Twitter tags per route (Academy articles get their title and first paragraph); `/admin`, `/account` and unknown routes are `noindex`
- **Adding a page:** add the `<Route>` in `App.tsx` and a matching entry in `ROUTE_META` in `SeoHead.tsx` (title + description) — the sitemap picks the route up automatically. New Academy articles only need their `contentMap` entry in `pages/Article.tsx`
- Static defaults (including the 1200×630 share image `public/og-image.png`) live in `index.html`, so link previews work for crawlers that don't run JavaScript

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
│   │   │   ├── pages/        # Home, Stocks, Stock, AnalysisDetail, Profile, TrackRecord, Calculator, GrahamCalculator, FIRE, Portfolio, Academy, Admin, Account, Contact …
│   │   │   ├── components/   # SievooLogo, AnalysisCard, Navbar, Footer, community/ (chart, share, follow, comments) …
│   │   │   ├── lib/          # auth (session + apiFetch), i18n (EN/NO), format (money/percent), community-api (query hooks)
│   │   │   └── hooks/
│   │   ├── vite-plugin-seo.ts      # server-side meta/content injection + dynamic sitemap for `vite preview`
│   │   ├── vite-plugin-sitemap.ts  # build-time list of static pages
│   │   └── index.html        # Analytics tag lives here
│   └── api-server/                # Express API     (@workspace/api-server)
│       └── src/
│           ├── routes/       # analyses, comments, contact, admin, watchlist, ticker, auth, stocks, users, follows, track-record, og, seo
│           ├── lib/          # market-data (price/fundamentals/insider/trending/FX fetch), valuation (DCF + Graham math), watchlist-job, trending-job,
│           │                 # oslo-tickers, coverage, stock-data, track-record, alerts, mailer, og-image, sessions, format
│           ├── watchlist-worker.ts   # standalone entrypoint for the scheduled AutoDCF/AutoValue job (weekly)
│           └── trending-worker.ts    # standalone entrypoint for the daily trending-ticker discovery job
├── lib/
│   ├── api-spec/              # openapi.yaml  → single source of truth for API contracts
│   ├── api-client-react/      # Orval-generated React Query hooks (do not edit manually)
│   ├── api-zod/                # Orval-generated Zod schemas   (do not edit manually)
│   │   ├── watchlist.ts       # hand-written watchlist schemas (kept outside src/generated)
│   │   ├── auth.ts            # hand-written account schemas
│   │   └── community.ts       # hand-written stock/profile/follow schemas
│   └── db/                        # Drizzle ORM schema + connection
│       └── src/schema/
│           ├── analyses.ts
│           ├── comments.ts
│           ├── contact_messages.ts
│           ├── admin_config.ts
│           ├── users.ts       # users + user_sessions
│           ├── alerts.ts      # ticker_follows (alerts)
│           └── watchlist.ts   # watchlist_companies + watchlist_valuations (incl. Graham/AutoValue + currency columns)
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

**Favicon & app icons** live in `artifacts/sievoo/public/`: `favicon.svg` (master), `favicon.ico` (16/32/48), `favicon-48x48.png`, `apple-touch-icon.png` (180), `icon-192.png` / `icon-512.png` and `site.webmanifest`, all linked from `index.html`. Search engines need a crawlable icon whose size is a multiple of 48px, so keep the `.ico`/48px PNG in place when changing the logo.

---

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm 10 (pinned via `packageManager` in `package.json`; run `corepack enable` to use the exact version)
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
| `ADMIN_INITIAL_PASSWORD` | — | Only used when no admin account exists yet; creates it with this password. Remove after first start |
| `ADMIN_RESET_PASSWORD` | — | Break-glass reset: overwrites the existing admin password (min. 12 characters) and signs out all admin sessions on startup. Remove it right after logging in, or every restart resets the password again |
| `SMTP_URL` | — | Outgoing mail for ticker alerts and the weekly digest, e.g. `smtps://user%40domain:app-password@smtp.gmail.com:465` (api-server, watchlist-worker, trending-worker). Without it alerts only show on the Account page |
| `MAIL_FROM` | — | Sender, e.g. `Sievoo <alerts@sievoo.com>`. Defaults to the SMTP user |
| `SITE_URL` | — | Public site URL used in emails, canonical URLs and share images. Defaults to `https://sievoo.com` |
| `OSLO_TICKERS` | — | Comma-separated override of the Oslo Børs coverage list (e.g. `EQNR.OL,DNB.OL`) |
| `API_URL` | — | **sievoo-web only**: URL of the api-server. `/api` calls are proxied there, and the SEO middleware fetches page data from it |
| `RAILPACK_INSTALL_CMD` | — | `pnpm install --frozen-lockfile` — builds fail if `pnpm-lock.yaml` is out of sync with `package.json`, so commit the lockfile after every dependency change |

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

### Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: frozen install, `pnpm run typecheck`, and builds of the frontend and API server. Railway deploys independently, so check the CI status after pushing.

### Regenerate API Client (after openapi.yaml changes)

```bash
pnpm --filter @workspace/api-spec run codegen
```

Import generated hooks and schemas through the package barrels (`@workspace/api-client-react`, `@workspace/api-zod`) — never from their `src/generated/...` paths directly.

---

## API Overview

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analyses` | List community analyses (sort, search, pagination) |
| `POST` | `/api/analyses` | Publish a new analysis (attributed to the account when logged in) |
| `GET` | `/api/analyses/:id` | Get single analysis |
| `PATCH` / `DELETE` | `/api/analyses/:id` | Edit / delete (owner session for account analyses, PIN for anonymous ones) |
| `POST` | `/api/analyses/:id/like` | Like an analysis |
| `GET` | `/api/analyses/stats` | Community statistics |
| `GET` | `/api/analyses/:id/comments` | List comments |
| `POST` | `/api/analyses/:id/comments` | Post a comment (account required) |
| `POST` | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | User accounts |
| `GET` / `PATCH` | `/api/auth/me` | Current user / update public name and weekly digest setting |
| `GET` | `/api/stocks` | Every tracked stock with its latest valuation |
| `GET` | `/api/stocks/:ticker` | Stock page data: latest numbers, history, community analyses, followers, own follow |
| `GET` | `/api/users/:id` | Public profile with scored calls |
| `GET` | `/api/track-record` | Method accuracy + analyst leaderboard |
| `GET` | `/api/follows` | Own followed tickers (account required) |
| `PUT` / `DELETE` | `/api/follows/:ticker` | Follow (with alert settings) / unfollow (account required) |
| `GET` / `POST` | `/api/alerts/unsubscribe?token=` · `/api/alerts/digest-off?token=` | One-click email opt-outs |
| `GET` | `/api/og/{stock/:ticker,analysis/:id,user/:id,page/:name}.png` | Dynamic share images |
| `GET` | `/api/seo/render?path=` · `/api/seo/sitemap` | Server-side SEO data for the web service |
| `GET` | `/api/watchlist` | List followed companies with their latest valuation |
| `GET` | `/api/watchlist/:id/history` | Full AutoDCF/AutoValue/price history for one watchlist company (public, used by the Watchlist page's History tab) |
| `POST` | `/api/admin/watchlist` | Add a company to the watchlist (auth required) |
| `DELETE` | `/api/admin/watchlist/:id` | Remove a company from the watchlist (auth required) |
| `POST` | `/api/admin/watchlist/refresh` | Manually trigger a watchlist refresh run (auth required) |
| `GET` | `/api/admin/watchlist/:id/history` | Get a company's full AutoDCF/AutoValue run history for the Statistics tab (auth required) |
| `GET` | `/api/ticker-lookup` | Look up a company name from a ticker (public, used for auto-fill) |
| `POST` | `/api/contact` | Submit contact form (rate-limited: 5 req/hr per IP) |
| `POST` | `/api/admin/auth` | Admin login (rate-limited: 10 attempts/15 min) |
| `GET` | `/api/admin/messages` | List contact messages (auth required) |
| `PATCH` | `/api/admin/messages/:id` | Mark message read (auth required) |
| `POST` | `/api/admin/change-password` | Change admin password (auth required) |
| `GET` | `/ads.txt` | Google AdSense ads.txt |

Account endpoints take the session token as `Authorization: Bearer <token>` (the older `x-auth-token` header is still accepted); the frontend sets it once via the generated client's `setAuthTokenGetter` in `main.tsx`. The stock, profile, follow and track-record endpoints use hand-written Zod schemas (`lib/api-zod/src/community.ts`) like the watchlist and auth endpoints, pending a spec update. Admin endpoints require the `x-admin-token` header. There is no default admin password: on a fresh database, set `ADMIN_INITIAL_PASSWORD` before first start to create the admin account, then remove the variable and change the password in `/admin`.

---

## Key Architecture Decisions

- **All manual DCF math is client-side.** The API mainly handles persistence (community feed, admin, contact) and the watchlist's server-side valuation runs. No server round-trips for the interactive calculator itself.
- **Contract-first API.** `lib/api-spec/openapi.yaml` is the single source of truth for the core CRUD endpoints. Always edit the spec first, then run codegen before touching frontend or backend code. The watchlist endpoints currently ship as hand-written Zod schemas (`lib/api-zod/watchlist.ts`) pending a spec update.
- **`type: number` in the OpenAPI spec**, not `type: integer` — Orval generates `zod.int()` for integers, which does not exist in Zod v3/v4.
- **In-memory rate limiting** (per process). Suitable for single-instance deployment; swap for Redis if multi-instance scaling is needed.
- **Admin auth** uses scrypt with a random salt (stored as `scrypt$<salt>$<hash>`, shared helpers in `lib/password.ts`) and a random session token stored in the DB, passed via the `x-admin-token` header. Older SHA-256 hashes are accepted once and upgraded to scrypt on the next successful login.
- **Watchlist data source**: current price, fundamentals, and insider activity are fetched from a public, no-API-key market data feed. Since this feed is unofficial, per-ticker failures are caught and logged individually rather than failing the whole run, and insider data falls back to a neutral score when unavailable for a given ticker.
- **AutoValue rides the same job as AutoDCF.** Rather than a separate cron service, the Graham Number is computed inside the same `processCompany()` call that runs the DCF, from the same market-data fetch. This means it automatically runs on both the weekly `watchlist-worker` and the daily `trending-worker` schedules with no extra Yahoo Finance calls or moving parts.
- **Valuation history is append-only.** Each `watchlist-job` run inserts a new `watchlist_valuations` row rather than updating the previous one, which is what makes the Statistics tab's multi-year price-vs-DCF-vs-Graham chart possible without a separate history table.
- **Cron worker env vars**: the Railway Postgres plugin does not expose a ready-made `DATABASE_URL` — a reference like `${{Postgres.DATABASE_URL}}` silently resolves to nothing. Build it from the individual variables instead: `postgresql://${{Postgres.POSTGRES_USER}}:${{Postgres.POSTGRES_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.POSTGRES_DB}}`. Variables only take effect from the next deployment: a redeploy is needed (a manual redeploy does not run a cron job — it runs at the next scheduled time, so to verify a fix, temporarily set the schedule a few minutes ahead).

---

## Deployment

The project runs as two always-on services plus two scheduled jobs, all deployed from this monorepo:

1. **`sievoo-web`** — builds and serves the frontend (`pnpm --filter @workspace/sievoo run build`)
2. **`api-server`** — builds and runs the Express API (`pnpm --filter @workspace/api-server run build` / `run start`), with `pnpm --filter @workspace/db run push-force` applied as a pre-deploy step so schema changes roll out automatically
3. **`watchlist-worker`** — same codebase as `api-server`, deployed as a separate service with its own entrypoint (`run start:watchlist-worker`) and a weekly cron schedule (Mondays 06:00 UTC) instead of a continuous process. Runs AutoDCF + AutoValue for every followed company, then checks ticker alerts and sends the weekly digest.
4. **`trending-worker`** — same codebase again, its own entrypoint (`run start:trending-worker`), daily cron schedule (05:00 UTC). Discovers trending US tickers from Yahoo Finance and the next companies from the Oslo Børs list, onboards new ones, runs AutoDCF + AutoValue on them immediately via the same `processCompany()` job as above, then checks ticker alerts.

For other platforms:

1. Build: `pnpm run build`
2. Serve the API: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
3. Serve the frontend with `pnpm --filter @workspace/sievoo run serve` (and `API_URL` set) to get the server-rendered SEO pages and dynamic sitemap; or serve `artifacts/sievoo/dist/public` as static files with an SPA fallback (pages then render client-side only)
4. Run the watchlist job on a schedule: `node --enable-source-maps artifacts/api-server/dist/watchlist-worker.mjs`
5. Run the trending discovery job on a schedule: `node --enable-source-maps artifacts/api-server/dist/trending-worker.mjs`

### Domain & DNS

DNS for `sievoo.com` is managed in Cloudflare:

- `sievoo.com` — proxied CNAME to the `sievoo-web` Railway service
- `www.sievoo.com` — proxied CNAME to `sievoo.com`; a Cloudflare redirect rule (`http_request_dynamic_redirect`) sends it to `https://sievoo.com` with a 301, keeping path and query string
- TXT `_railway-verify` (Railway custom-domain verification) and TXT `google-site-verification` (Search Console) — **do not remove**

---

## Roadmap

- Set `SMTP_URL` / `MAIL_FROM` on `api-server`, `watchlist-worker` and `trending-worker` so alert and digest emails go out
- Ticker auto-fill for the Graham Calculator: extend `/api/ticker-lookup` (or add an endpoint) to return EPS and book value per share from the same fundamentals feed the watchlist worker uses
- Monthly valuation challenges on top of the leaderboard (a shared ticker list, scored at month end)
- Move the hand-written stock/profile/follow/auth/watchlist schemas into `openapi.yaml` and regenerate the clients
- Norwegian versions of the remaining pages (calculator labels, legal pages)

---

## License

MIT
