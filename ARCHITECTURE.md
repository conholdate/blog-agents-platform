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
│       └── overview/all/       # GET — aggregated stats across all agents
├── components/
│   └── dashboard/          # All UI components (Sidebar, sections, cards, drawers)
└── lib/
    ├── sheets.ts           # Google Sheets API wrappers + getKeywordSummary
    ├── optimizationSheets.ts  # Optimization queue/log parsing + getOptimizationSummary
    ├── translationSheets.ts   # Translation scan/history parsing + getTranslationSummary
    ├── url-validator-sheets.ts # URL Validator sheet I/O + getUrlValidatorSummary
    ├── config.ts           # Domain → Sheet ID map, brand colors, platform colors
    └── cache.ts            # Server-side in-memory cache with TTL
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

API routes use a server-side in-memory cache (`lib/cache.ts`), with a TTL per tool matching its update cadence: Keyword Agent 2h, Optimization Agent 4h, Translation Agent 4h, URL Validator 6h. Cache can be force-busted by the "Refresh" button in the UI, which sends `?refresh=1` on the next API call. Because the cache is an in-memory `Map`, it does not persist across separate serverless invocations on Vercel — each cold-started function starts with an empty cache, refilled on first request.

### Deployment

- Hosted on **Vercel**, auto-deploys from `main` branch
- Root directory set to `dashboard/` in Vercel project settings
- Environment variables managed in the Vercel dashboard

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

- **Google Sheets as the data layer** — all agents read/write through Sheets; no database
- **Per-domain isolation** — each domain has its own sheet(s); no cross-domain queries
- **Server-side only secrets** — credentials never reach the browser
- **No shared runtime code** between `dashboard/` and `url-validator/` — they are independent tools
