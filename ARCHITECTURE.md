# Architecture — Blog Agents Platform

## Overview

**Blog Agents Platform** is the control center for AI agents that automate blog content operations for the Blog Team at Aspose, GroupDocs, and Conholdate.

AI agents run autonomously and produce output — keyword briefs, SEO priority rankings, post drafts, translations. The platform (web app) is where the team monitors, reviews, and acts on that output across 6 brand domains. **Google Sheets is the shared data layer** between agents and the platform; agents write to Sheets, the platform reads and displays the results.

Each sub-project is independently deployable and shares no runtime code.

```
blog-agents-platform/
├── dashboard/        # Web control center — Next.js 16 app (live on Vercel)
└── url-validator/    # URL Validator — Python 3 CLI (also runs via the platform)
```

---

## 1. Blog Agents Platform (Dashboard)

**Live:** [Blog Agents Platform](https://blog-agents-platform.vercel.app)  
**Stack:** Next.js 16 · App Router · React 19 · Tailwind CSS v4 · Google Sheets API v4 · Vercel

### Structure

```
dashboard/
├── app/
│   ├── layout.tsx          # Root layout — fonts, global CSS
│   ├── page.tsx            # Single-page shell, renders active section
│   └── api/                # Route handlers (all server-side)
│       ├── sheets/[domain]/
│       │   ├── tabs/           # GET — list sheet tabs for a domain
│       │   ├── [tab]/          # GET — fetch rows for a tab
│       │   │   └── move/       # POST — reorder rows (batchUpdate)
│       │   ├── generated/      # GET — Generated Blog Posts tab
│       │   └── summary/        # GET — status counts per product
│       ├── optimization/[domain]/
│       │   ├── route.ts        # GET — optimization queue rows
│       │   └── summary/        # GET — priority breakdown counts
│       ├── translation/[domain]/
│       │   ├── route.ts        # GET — missing-translation scan + history rows
│       │   └── summary/        # GET — missing/pending/partial/completed counts
│       ├── url-validator/[domain]/
│       │   ├── run/            # POST — trigger a scan
│       │   ├── status/         # GET — scan status
│       │   ├── results/        # GET — scan results
│       │   └── summary/        # GET — issue counts per domain
│       ├── workflows/[domain]/
│       │   ├── runs/               # GET — recent GitHub Actions runs (+ [runId]/jobs for failure detail)
│       │   ├── schedules/          # GET — cron schedules parsed from workflow YAML
│       │   └── summary/            # GET — deployment cards + daily runs + next scheduled run
│       ├── repo-doctor/
│       │   ├── [domain]/
│       │   │   ├── run/            # POST — SSE-streamed scan (manual/cron/webhook all call this)
│       │   │   ├── status/         # GET — is this domain configured, is the write token set
│       │   │   ├── results/        # GET — full scan result (self-healing: scans on cache miss)
│       │   │   ├── summary/        # GET — issue counts by type
│       │   │   ├── fix-log/        # GET — durable Fix Log history, read from the Sheet
│       │   │   └── fix/
│       │   │       ├── preview/    # POST — compute the fix, no GitHub write
│       │   │       └── confirm/    # POST — branch, commit, open PR (the only write path)
│       │   └── webhook/            # POST — inbound, shared-secret-authenticated on-commit trigger
│       └── overview/all/       # GET — aggregated stats across all agents
├── components/
│   └── dashboard/          # Sidebar, Overview (shell) + one subfolder per agent:
│       ├── optimization/       # OptimizationAgent.tsx
│       ├── translation/        # TranslationAgent.tsx
│       ├── url-validator/      # UrlValidator.tsx
│       ├── workflows/          # Workflows.tsx + its DailyRunsChart/DeployTag/etc. helpers
│       └── repo-doctor/        # RepoDoctor.tsx, FixedIssuesList.tsx, HowItWorks.tsx, shared.ts
└── lib/
    ├── sheets.ts           # Google Sheets API wrappers + getKeywordSummary
    ├── config.ts           # Domain → Sheet ID map, brand colors, platform colors
    ├── cache.ts            # Server-side in-memory cache with TTL
    ├── optimization/optimizationSheets.ts  # Optimization queue/log parsing + getOptimizationSummary
    ├── translation/translationSheets.ts    # Translation scan/history parsing + getTranslationSummary
    ├── url-validator/url-validator-sheets.ts # URL Validator sheet I/O + getUrlValidatorSummary
    ├── workflows/workflows.ts              # CI/CD run + schedule parsing + getWorkflowsSummary
    └── repo-doctor/                         # see "Repo Doctor" below — detect.ts, github.ts, llm.ts,
                                              # repo-doctor.ts, repo-doctor-config.ts, repo-doctor-sheets.ts

Each per-agent subfolder under components/dashboard/ and lib/ is owned by
that agent alone — a new agent (e.g. Post Generation) gets its own
components/dashboard/post-generation/ and lib/post-generation/ without
touching another agent's files. Only Overview.tsx (summary tiles) and
Sidebar.tsx (nav entry) are shared integration points every agent touches.
```

### Data Flow

```
Browser (React client)
    │
    ▼
Next.js API Routes (server-side, /app/api/)
    │  ↓ uses Google Sheets API v4
    ▼
Google Sheets (one spreadsheet per domain × agent)
    │  ↑ reads/writes via service account
    ▼
lib/sheets.ts  ←→  lib/cache.ts (per-tool TTL — see Caching below)
```

`/api/overview/all` aggregates stats across every domain by calling each tool's `get*Summary()` lib function directly (in-process), never via HTTP to its own routes — a serverless function fetching its own deployment URL is unreliable (no guaranteed `localhost` listener, extra cold-start risk), so this pattern is intentional and should be followed for any future cross-agent aggregation.

### Authentication

Google Sheets access uses a **service account** — the JSON key is stored in the `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable and parsed at runtime in `lib/sheets.ts`. No OAuth flow is involved.

Dashboard edit access is guarded by a PIN stored as `NEXT_PUBLIC_EDITOR_PIN`. The PIN is validated client-side and the value is remembered in `sessionStorage` for the browser session.

### Domain Model

The dashboard supports 6 brand domains:

| Domain key | Brand |
|---|---|
| `aspose` | Aspose |
| `aspose-cloud` | Aspose Cloud |
| `groupdocs` | GroupDocs |
| `groupdocs-cloud` | GroupDocs Cloud |
| `conholdate` | Conholdate |
| `conholdate-cloud` | Conholdate Cloud |

Each domain maps to one or more Google Spreadsheet IDs, configured in `lib/config.ts`.

### Caching

API routes use a server-side in-memory cache (`lib/cache.ts`), with a TTL per tool matching its update cadence: Keyword Agent 2h, Optimization Agent 4h, Translation Agent 4h, URL Validator 6h, CI/CD Status 5min (run status changes fast) / 6h for parsed cron schedules, Repo Doctor 6h for scan results and 10min for a pending fix preview (see below). Cache can be force-busted by the "Refresh" button in the UI, which sends `?refresh=1` on the next API call. Because the cache is an in-memory `Map`, it does not persist across separate serverless invocations on Vercel — each cold-started function starts with an empty cache, refilled on first request.

### Repo Doctor — the one agent that writes to GitHub

Every other tool in the dashboard is Sheets-in/Sheets-out (or, for CI/CD Status, GitHub-read-only). Repo Doctor is the exception: it can open pull requests.

- **Detection is deterministic, isolated from GitHub/LLM I/O** — `lib/repo-doctor/detect.ts` operates on raw file text with no network calls, so it's fully unit-testable (`repo-doctor.test.ts`) and can never hallucinate what counts as an issue. The LLM (`lib/repo-doctor/llm.ts`, an internal OpenAI-compatible gateway) only phrases an already-detected issue and, for two issue types, drafts replacement text — which is always re-validated (`JSON.parse`) before it can be shown as a preview, let alone committed.
- **Two GitHub tokens, deliberately not one.** `GITHUB_READONLY_TOKEN` (Workflows/CI-CD Status) and `GITHUB_WRITE_TOKEN` (Repo Doctor, in `lib/repo-doctor/repo-doctor-config.ts`) are separate env vars precisely so a read path accidentally importing the write-scoped getter — or vice versa — fails obviously in review, rather than silently working with more privilege than intended.
- **Fix It is two requests, not one**, matching the two-phase UI: `previewFix()` fetches the file fresh, re-detects to guard against staleness, computes the patch, and caches it (keyed by a `previewId`, 10-minute TTL) — no GitHub write happens here. `confirmFix()` re-fetches once more to catch a race since the preview, then creates a branch, commits, and opens the PR, reusing the *exact same* cached patch rather than recomputing (so what's committed is byte-identical to what was previewed). PRs are never auto-merged.
- **A durable Fix Log, separate from the live issue list.** The current issue list is never persisted — it's always re-derived fresh from GitHub (cheap: one file fetch + six pure functions), matching CI/CD Status's philosophy of not duplicating a source of truth that's already durable elsewhere. Confirmed *fixes*, however, have no other durable record a non-engineer can browse, so `logFixedIssue()` appends one row per fix to a dedicated Google Sheet (`REPO_DOCTOR_LOG_SHEET_ID`) — the one piece of this feature that *is* Sheets-backed.
- **Domain → repo mapping** lives in `REPO_DOCTOR_REPOS` (`lib/repo-doctor/repo-doctor-config.ts`), the same `{owner, repo, filePath}`-per-domain shape as `WORKFLOWS_REPOS`. All 6 domains are populated as of this writing; a 7th domain is a one-line addition, verified against the real file before being added (this is how a real bug was caught during rollout — see below).
- **GitHub's Contents API omits inline file content over ~1MB** (`aspose-blog/Redirects.json` is 2.4MB) — `lib/repo-doctor/github.ts`'s `fetchFileContent()` falls back to a raw-media-type request when the JSON response's `content` field comes back empty, rather than silently treating a large file as blank.
- **Self-loop/chain detection only strips a redirect target's host when it matches the domain's own hostname** (`normalizePath(value, domain)`) — a deliberate cross-subdomain redirect (blog → about, confirmed live in two different domains' files) is left as a full URL rather than being collapsed to a bare path and mistaken for a self-loop.
- **Triggers**: manual "Run Scan" click, a weekly GitHub Actions cron (`repo-doctor.yml` at the repo root, curling the deployed dashboard), and — per opted-in content repo — an on-commit webhook (`app/api/repo-doctor/webhook/route.ts`, shared-secret auth via `crypto.timingSafeEqual`) triggered by a workflow file living in that *content* repo, not this one.

### Deployment

- Hosted on **Vercel**, auto-deploys from `main` branch
- Root directory set to `dashboard/` in Vercel project settings
- Environment variables managed in the Vercel dashboard
- Repo Doctor's weekly cron and on-commit webhooks are GitHub Actions, external to Vercel — see `.github/workflows/repo-doctor.yml`

---

## 2. URL Validator

**Stack:** Python 3 · gspread · Google Sheets API v4 · CLI

### Structure

```
url-validator/
├── main.py             # Entry point — scanner, validators, Sheet writer
├── test_main.py        # pytest unit tests
├── requirements.txt    # Python dependencies
├── credentials.json    # Google service account key (gitignored)
└── VALIDATION_RULES.md # Detailed rule documentation
```

### Data Flow

```
Blog repo (frontmatter .md files on disk)
    │
    ▼
main.py — scans all product/post directories
    │  applies 8 validation rules per file
    ▼
Google Sheets (daily tab + summary tab per run)
    │  written via gspread + service account
    ▼
dashboard/api/url-validator/ — reads results to display in dashboard UI
```

### Validation Rules

Eight rules are checked per frontmatter file:

| Rule | Description |
|---|---|
| `MISSING_URL` | No `url` field in frontmatter |
| `MISSING_TRAILING_SLASH` | URL doesn't end with `/` |
| `WRONG_PRODUCT` | URL product segment doesn't match post's folder |
| `DATE_BASED_URL` | URL uses `/YYYY/MM/DD/slug/` format |
| `URL_TOO_SHORT` | Too few path segments |
| `LANG_CODE_MISMATCH` | Translated file has wrong language prefix |
| `URL_MISMATCH_WITH_ENGLISH` | Translated URL slug differs from English base |
| `NO_ENGLISH_BASE` | Translated file exists but `index.md` is missing |

---

## Shared Conventions

- **Google Sheets as the data layer** — all agents read/write through Sheets; no database. The one exception: Repo Doctor's live issue list is read straight from GitHub (never persisted, always re-derivable), with only its confirmed-fix *history* logged to a Sheet
- **Per-domain isolation** — each domain has its own sheet(s); no cross-domain queries
- **Server-side only secrets** — credentials never reach the browser
- **No shared runtime code** between `dashboard/` and `url-validator/` — they are independent tools
