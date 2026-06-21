# Blog Agents Platform — Implementation Plan

**Last updated:** 2026-06-21  
**Monorepo:** [github.com/conholdate/blog-agents-platform](https://github.com/conholdate/blog-agents-platform)  
**Maintained by:** Shoaib Khan

---

## Monorepo Overview

```
blog-agents-platform/
├── dashboard/           # Web control center — Next.js app (Live on Vercel)
└── url-validator/       # URL Validator — Python CLI (also runs via the platform)
```

Each agent and tool is self-contained and deployed independently. Google Sheets is the shared data layer — agents write output to Sheets, the platform reads and displays it.

---

## 1. Blog Agents Platform (Dashboard)

**Folder:** `dashboard/`  
**Live:** [Blog Agents Platform](https://blog-agents-platform.vercel.app)  
**Stack:** Next.js 16 · Tailwind CSS v4 · Google Sheets API v4 · Vercel  
**Status: Active / Production**

### What It Does

The web control center for all blog agents. AI agents run autonomously and write output to Google Sheets — the platform reads those Sheets and lets the team monitor, review, and act on the output. Left sidebar navigation across 6 brand domains (Aspose, GroupDocs, Conholdate + Cloud variants) with sections for each agent: Overview, Keyword Agent, Post Generation Agent, Translation Agent, Optimization Agent, URL Validator.

---

### Features Completed

#### Core Data Layer
- [x] Read Google Sheets via service account (Google Sheets API v4)
- [x] Multi-domain support — 6 sheets mapped to 6 brand domains
- [x] Dynamic product tab listing per domain
- [x] Empty row filtering — rows with all blank cells are excluded
- [x] Multi-delimiter parsing for bullet fields (`|` and newline / Alt+Enter)
- [x] "Open Sheet" link — direct link to the Google Spreadsheet from the tab bar

#### Dashboard Shell
- [x] Left sidebar navigation — Overview, Keyword Agent, Translation Agent, Optimization Agent, Post Generation Agent, URL Validator
- [x] Active section highlighted with left accent border
- [x] Mobile sidebar as hamburger-toggled overlay drawer
- [x] Domain switcher pills in sticky header — always visible across all sections
- [x] Section switching resets keywords state (tabs, rows, errors)
- [x] "Blog Agents" branding in header

#### Overview Section
- [x] Keywords stats card — pending / ok / rejected counts + per-product progress bars (live data)
- [x] Translation Agent card — Missing / Pending / Partial / Completed counts (live data)
- [x] WIP placeholder cards for Post Generation Agent (Optimization Agent and URL Validator are also live, predating this list)
- [x] "View →" link navigates directly to the relevant section
- [x] `/api/sheets/[domain]/summary` endpoint — fetches all tabs in parallel, returns status counts
- [x] "All Domains" toggle — cross-domain table (Keywords / Translations / Optimization / URL Validator columns), each cell links into that domain + section
- [x] Fixed: `/api/overview/all` returned no data in production — it was self-fetching its own API routes over an unset `NEXT_PUBLIC_BASE_URL` (falling back to a `localhost:3000` that doesn't exist inside a Vercel serverless function). Summary logic was extracted into shared `lib` functions (`getKeywordSummary`, `getOptimizationSummary`, `getUrlValidatorSummary`, `getTranslationSummary`) and called in-process instead

#### Translation Agent
- [x] Reads the consolidated scan sheet (`TRANSLATION_SCAN_SHEET_ID`) — one tab per domain (overwritten on each daily scan) plus a shared `history` tab
- [x] "Missing Translations" tab — posts still missing a translation, with author, missing count, missing/extra language chips
- [x] "History" tab — per-post translation progress (`pending` / `partial` / `completed`) filtered to the active domain from the shared history log
- [x] Product filter pills, language filter dropdown (options derived from the data, not hardcoded per domain), URL/product search, sortable columns
- [x] "Open Sheet" link, manual Refresh (bypasses cache)
- [x] `/api/translation/[domain]` and `/api/translation/[domain]/summary` endpoints

#### WIP Placeholder
- [x] Section icon, label, "Coming Soon" badge, description per section
- [x] Shows active domain name

#### Navigation & Shell
- [x] Domain switcher in top nav (Aspose, Aspose Cloud, GroupDocs, GroupDocs Cloud, Conholdate, Conholdate Cloud)
- [x] Product tab bar per domain (Words, Cells, PDF, etc.) — Keyword Agent section only
- [x] "All Missing Topics" tab separated from product tabs, shown with a message + link to open in Sheets
- [x] Race condition fix for fast domain switching (cancelled flag pattern)
- [x] Dark theme shell (slate-800 page, slate-900 header)
- [x] Mobile-responsive layout — scrollable nav, responsive padding

#### Card Display
- [x] Card grid replacing flat table view — one card per brief
- [x] Collapsible cards — collapsed by default, first card expanded on load
- [x] Banner always visible — shows product, category, sub-category, platform tags
- [x] Post title shown inline in banner when card is collapsed
- [x] Platform-colored banners — `.NET/C#` purple, `Java` maroon, `Python` blue, `C++` blue, `Node.js` green
- [x] Brand color fallback when no platform match (Aspose blue, GroupDocs green, Conholdate orange/purple)
- [x] Expanded body — title, status badge, keywords (primary / secondary / long-tail / semantic), content brief (persona + angle), outline, editorial notes
- [x] Keywords colour-coded by type (secondary blue, long-tail orange, semantic teal)
- [x] Outline and Editorial Notes displayed side by side (2/5 outline, 3/5 notes)
- [x] Full outline shown — no item cap or truncation

#### Editing
- [x] PIN authorization — prompted on first edit, persists for the session via `sessionStorage`
- [x] Right-side edit drawer (RowDrawer) with all editable fields
- [x] Read-only info section in drawer (brand, product, run ID, generated date, etc.)
- [x] Editable fields: Status, Title, Primary Keyword, Secondary/Long-tail/Semantic Keywords, Persona, Angle, Outline, Editorial Notes, Selected Platform
- [x] Bullet fields stored as pipe-separated in sheet, edited as one-per-line in textarea
- [x] Batch cell update — only changed fields are written to the sheet
- [x] Close drawer on Escape key or backdrop click
- [x] Editing correctly targets sheet row regardless of unsaved UI reorder (row carries its `_rowIndex`)

#### Row Reordering
- [x] Up/Down arrow buttons on each card banner
- [x] Instant UI reorder — no API call on each move
- [x] Save Order / Discard bar appears when order has been changed
- [x] Save Order — writes all rows to new positions in one batch API call (`batchUpdate`)
- [x] Discard — restores original order without touching the sheet

#### Deployment & Ops
- [x] Deployed on Vercel, auto-deploys on push to `main`
- [x] Environment variables managed in Vercel dashboard
- [x] Multi-remote git setup — GitHub org (`conholdate`), GitHub personal (`shoaibkhan-aspose`)

---

### Planned / Pending

#### Near Term
- [ ] **GitLab push** — remote added but push via HTTPS + PAT not yet confirmed working
- [ ] **Search / filter** — filter cards by title, keyword, or status without leaving the page
- [ ] **Status filter** — quick-filter buttons to show only `pending`, `ok`, or `rejected` cards

#### Medium Term
- [ ] **Bulk status update** — select multiple cards and change status in one action
- [ ] **Add new row** — create a new brief entry from the UI (currently sheet-only)
- [ ] **Delete row** — soft-delete or remove a brief from the UI
- [ ] **"All Missing Topics" card view** — currently shows a fallback message; could be rendered as a simplified card grid

#### Longer Term / Nice to Have
- [ ] **Virtual scrolling / pagination** — for sheets with 100+ rows, avoid rendering all cards at once
- [ ] **Notifications** — alert the team when a brief status changes
- [ ] **Role-based access** — differentiate read vs. edit permissions per domain or product

---

### Architecture Notes

| Layer | Detail |
|---|---|
| Frontend | Next.js 16 App Router, client components for interactivity |
| API routes | `/api/sheets/[domain]/tabs` · `/api/sheets/[domain]/[tab]` · `/api/sheets/[domain]/[tab]/move` |
| Sheets lib | `lib/sheets.ts` — `getSheetTabs`, `getSheetRows`, `saveSheetRows`, `reorderRows` |
| Config | `lib/config.ts` — domain → sheet ID map, brand colors, platform colors |
| Auth | Google service account JSON in env var `GOOGLE_SERVICE_ACCOUNT_JSON` |

---

## 2. URL Validator

**Status: Development Phase — not production ready**  
**Stack:** Python 3 · Google Sheets API (gspread) · CLI

### What It Does

Scans blog post frontmatter files for URL issues and writes a colour-coded report to a Google Sheet. Currently supports **blog.aspose.com** only.

### Error Types Detected

| Error | Description |
|---|---|
| `MISSING_URL` | No `url` field in frontmatter |
| `MISSING_TRAILING_SLASH` | URL doesn't end with `/` |
| `WRONG_PRODUCT` | URL product segment doesn't match post's folder |
| `DATE_BASED_URL` | URL uses `/YYYY/MM/DD/slug/` instead of `/product/slug/` |
| `URL_TOO_SHORT` | Too few path segments |
| `LANG_CODE_MISMATCH` | Translated file has wrong language prefix |
| `URL_MISMATCH_WITH_ENGLISH` | Translated URL slug differs from English base |
| `NO_ENGLISH_BASE` | Translated file exists but `index.md` missing |

### Features Completed

- [x] Frontmatter scanner for all product and post directories
- [x] All 8 error types detected and reported
- [x] Output written to Google Sheets — daily full-issue tab + summary tab
- [x] Color-coded by error type in the sheet
- [x] Terminal progress output during scan
- [x] Unit tests (`test_main.py`)
- [x] Setup documented in README

### Planned / Pending

- [ ] **Multi-domain support** — extend to GroupDocs and Conholdate blog repos
- [ ] **CI/CD integration** — run automatically on a schedule (GitHub Actions / cron)
- [ ] **Web UI** — view scan results from a browser instead of only via Google Sheets
- [ ] **Auto-fix mode** — fix `MISSING_TRAILING_SLASH` and similar simple issues automatically
---

## New Tool Checklist

When adding a new tool to the monorepo:

1. Create a folder at repo root: `mkdir my-new-tool`
2. Build the tool inside it
3. Add a `README.md` with setup, usage, and status
4. Add the tool to the root `README.md` and this plan
5. Deploy on Vercel — set **Root Directory** to `my-new-tool/` during import
6. Add env vars to Vercel dashboard
