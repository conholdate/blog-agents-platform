# Blog Agents Platform

The web control center for AI agents that automate blog content operations at Aspose, GroupDocs, and Conholdate.

AI agents run autonomously and produce output — keyword briefs, SEO priority rankings, post drafts, translations, repo health checks. This platform is where the blog team monitors, reviews, and acts on that output. All 6 brand domains. One place.

**Live:** [Blog Agents Platform](https://blog-agents-platform.vercel.app)

---

## Sections

### Overview
Landing page for the active domain. Shows live stats for each active tool and click **View →** to jump directly to any section. Toggle between **This Domain** (cards for the selected domain) and **All Domains** (one table, every domain at once).

- **Keyword Agent card** — queued / approved / rejected / generated counts + per-product approved/total chips
- **Translation Agent card** — Missing / Pending / Partial / Completed counts
- **Optimization Agent card** — Pending / High / Medium / Optimized counts + Page 2 Posts / Avg Position / Avg Impressions / Avg CTR
- **URL Validator card** — Total Issues / Products Affected / Scans Run / Last Scan date + top 3 error types with proportional bars
- **CI/CD Status card** — latest production/staging deployment badges, run history strip, 14-day daily runs chart, next scheduled run
- **Repo Doctor card** — open issue count + a chip per issue type found in the domain's redirects file
- Coming-soon tools show their description until they go live
- **All Domains table** — one row per domain with Keywords / Translations / Optimization / URL Validator / CI/CD column groups; any cell links straight into that domain + section. Repo Doctor isn't in this cross-domain table yet — its card is This Domain only

### Keyword Agent
Review and edit AI-generated keyword briefs pulled from Google Sheets. Cards are sorted highest combined SEO + AEO score first.

**Layout** — three-column view per product tab:
- **Left (2/3)** — Queued and Rejected cards as compact tiles, adaptive grid (fits as many cards as the width allows)
- **Right (1/3)** — Approved cards as compact tiles, same adaptive grid; separated by a vertical divider

**Compact tile** (collapsed) shows:
- Status-coloured dot + title (never truncated)
- Platform chip (coloured by platform), SEO and AEO score chips (colour-coded: green ≥ 7.5, amber ≥ 5.0, red < 5.0)
- Status badge

**Expanded card** shows:
- Platform, category, sub_category, SEO score, AEO score as chips below the title
- Keywords — primary, secondary, long-tail (all shown), semantic; question / entity / clusters / rejected hidden behind **Show additional keywords**
- Content Brief — target persona and editorial angle
- Outline and Editorial Notes

When expanded, the card spans the full column width. In the narrow approved column, sections stack vertically instead of side by side.

Card banners are colour-coded by publishing platform (.NET, Java, Python, C++, Node.js) and fall back to the brand colour when no platform is set.

Rows with `status=generated` are hidden from product tabs and collected in the **Generated Blog Posts** tab instead.

### URL Validator
Scan blog post frontmatter for URL issues and view colour-coded results. Powered by the same validation logic as the standalone Python CLI.

- **Run Scan** — streams live progress product by product, then writes results to Google Sheets (requires `URL_VALIDATOR_CONTENT_DIR_*` to be set locally)
- **View Results** — reads the latest scan from Google Sheets; filter by error type using chips; links to the full sheet for 500+ results
- **Domain-aware** — switching the domain pill at the top automatically switches to that domain's sheet

Error types detected:

| Error | Description |
|---|---|
| `MISSING_URL` | No `url` field in frontmatter |
| `MISSING_TRAILING_SLASH` | URL doesn't end with `/` |
| `WRONG_PRODUCT` | URL product segment doesn't match the post's product folder |
| `DATE_BASED_URL` | URL uses `/YYYY/MM/DD/slug/` instead of `/product/slug/` |
| `URL_TOO_SHORT` | URL has too few path segments |
| `LANG_CODE_MISMATCH` | Translated file's URL has the wrong language prefix |
| `URL_MISMATCH_WITH_ENGLISH` | Translated URL slug differs from the English base URL |
| `NO_ENGLISH_BASE` | Translated file exists but `index.md` is missing |

### CI/CD Status
Read-only view of each domain's GitHub Actions activity — not an AI agent, a live GitHub API reader (no Sheet involved; nothing is written).

- **Deployment cards** — one card per (environment, provider) combo actually seen in the recent run window (e.g. Production/AWS, Production/Ceph, Staging/Ceph), classified from the workflow's display name (`prod`/`stag`, `aws`/`ceph`). Each shows the latest run's status badge, duration, time ago, success/fail counts, and — folded in from the separate schedules API — its next scheduled run if one exists
- **Scheduled Workflows** — whatever's left over after deploy schedules are folded into the cards above (e.g. a translation-scan cron with no matching recent run)
- **Daily Runs chart** — 14-day bar strip, zero-filled, with average build time
- **Run history table** — every recent run with workflow name, status, branch, actor, duration, updated-at; env/provider filter chips plus a per-workflow filter; click a failed row to fetch its failed job/step on demand (a separate, more expensive GitHub API call, fetched lazily rather than for every run)

Requires `GITHUB_READONLY_TOKEN` (classic PAT, `repo` scope, read-only usage) — the token can read Actions runs across all 6 domains' workflow repos (three `.com` domains use a dedicated `-workflows` repo; the three `.cloud` domains run CI inside their content repo directly).

### Repo Doctor
Scans a domain's redirects config file (`Redirects.json`) for data-quality issues, explains each one in plain English, and can open a pull request that fixes it — the only agent here that writes to GitHub rather than (or in addition to) a Sheet.

**Detection** — six deterministic rules run against the raw file text (no AI involved in deciding what's broken):

| Issue type | Catches | Fix |
|---|---|---|
| `DUPLICATE_KEY` | the same source path appears more than once | delete every occurrence but the last |
| `INVALID_JSON` | the file fails to parse | strip a trailing comma before a closing bracket, if that's the cause (the single most common real-world break — confirmed live) |
| `EMPTY_TARGET` | a redirect's target is blank | AI proposes a destination, re-validated before use |
| `MALFORMED_TARGET` | target has no leading `/` and no scheme | prepend `/`, or `https://` for a bare hostname |
| `SELF_LOOP_REDIRECT` | source and target are the same path *on this domain's own host* | delete the entry |
| `CHAINED_REDIRECT` | target is itself another entry's source | point straight at the final destination |

A same-site comparison only strips the host when it matches the domain's *own* hostname — a deliberate cross-subdomain redirect (e.g. blog → about) is left as a full URL so it's never mistaken for a self-loop.

**Fixing is two clicks, not one.** "Fix It" only computes and previews the exact diff — nothing is written to GitHub yet. "Confirm & Open PR" is the only action that writes anything: it re-fetches the file to guard against a race, creates a branch, commits the fix, and opens a PR titled and described automatically. **PRs are never auto-merged** — review and merge is a human action, same as any other PR. Every computed fix (deterministic or AI-drafted) is re-parsed as JSON before it can even be shown as a preview, so a bad suggestion is rejected before it's ever seen, let alone committed.

- **"How it works" panel** (`?` button) explains all of the above in-app, with a link out to a [detailed architecture diagram](https://blog-agents-platform.vercel.app/repo-doctor-internals.html) (`public/repo-doctor-internals.html`) covering both the scan and fix flows step by step
- **Open Issues / Fixed toggle** — Fixed reads back the durable Fix Log (a Google Sheet `logFixedIssue()` appends to on every confirmed fix), showing each fix's type, the literal file line that was removed or changed, when, and a link to its PR
- **Triggers**: a "Run Scan" button, a weekly GitHub Actions cron (`repo-doctor.yml`, Monday 04:00 UTC), and — for domains that opt in — an on-commit webhook from the content repo. All three call the same scan path

Requires `GITHUB_WRITE_TOKEN` (a *separate*, write-scoped PAT — never the same one as `GITHUB_READONLY_TOKEN`) to open PRs; scanning and viewing issues works without it. `PROFESSIONALIZE_API_KEY`/`BASE_URL`/`LLM_MODEL` (an internal OpenAI-compatible gateway) are optional — without them, explanations fall back to plain rule-based wording instead of AI-phrased text.

Live for all 6 domains as of this writing.

### Optimization Agent
Tracks SEO optimization progress for blog posts across all domains. Powered by two Google Sheets: a queue of posts to optimize (with Search Console metrics) and a log of already-optimized posts.

**Two tabs, each shown as a sortable table (one row = one post):**

- **Pending Optimization** — posts from the queue not yet optimized; default order matches the source sheet; click any column header to sort
- **Optimized Posts** — posts recorded in the optimization log, default sorted by last-optimized date descending

**Table columns (Pending):** `#` (original sheet order) · Priority · Product · Post URL · Impressions · CTR · Position · Clicks · Age (days)

**Priority score formula (SEO expert ranking):**
> `impressions × CTR efficiency × position opportunity × age factor`
>
> - *CTR efficiency*: actual CTR ÷ expected CTR for the post's position (capped at 5×). A post at position 55 clicking at 2.3% is 4.6× above expected — strong relevance signal, good content just buried
> - *Position opportunity*: 3× for pos 11–20 (page 2), 2× for 21–30, 1.5× for pos 5–10 and pos > 30
> - *Age factor*: older posts score up to 2× (stale content benefits most from a refresh)

Priority tiers: 🔴 High (score ≥ 400) · 🟡 Medium (100–399) · ⚪ Low (< 100) — displayed inline in the priority cell

**Colour coding:** CTR (green ≥ 3%, amber ≥ 1%, red < 1%) · Position (green ≤ 10, amber ≤ 20, grey > 20)

**Filters:** product filter chips (product extracted from URL path) + URL search box · click `#` to restore original sheet order

### Translation Agent
Tracks missing translations and translation progress across all domains. Powered by a single consolidated Google Sheet: one persistent tab per domain (overwritten on each daily scan) plus a shared `history` tab that tracks each post's translation status over time.

**Two tabs:**

- **Missing Translations** — posts from the active domain's scan tab that are still missing at least one translation: product, post link, author, missing count, missing-language chips, and any extra (orphaned) translation files
- **History** — every post the agent has ever tracked for this domain, with a status badge: `pending` (not yet started) / `partial` (some languages done) / `completed` (fully translated), plus the completion date once done

**Filters:** product filter chips, a language dropdown (options are derived from the data itself, not hardcoded — each domain supports a different language set), and a URL/product search box. Click any column header to sort.

**Out of scope:** the agent's separate Quality Check / Retranslate steps write to per-domain quality-score sheets that aren't wired into this screen yet.

### Post Generation Agent
Coming soon.

---

## Supported Domains

| Domain | Brand |
|---|---|
| blog.aspose.com | Aspose |
| blog.aspose.cloud | Aspose Cloud |
| blog.groupdocs.com | GroupDocs |
| blog.groupdocs.cloud | GroupDocs Cloud |
| blog.conholdate.com | Conholdate |
| blog.conholdate.cloud | Conholdate Cloud |

Switch between domains using the domain pills in the top navigation bar. All sections update for the selected domain.

---

## How to Use

### Navigation
- Use the **left sidebar** to switch between sections
- On mobile, tap the **hamburger menu** in the top-left corner

### Keywords — Browsing
1. Select a **domain** from the top nav
2. Click **Keyword Agent** in the sidebar
3. Select a **product tab** (e.g. Words, Cells, PDF) — cards are sorted by combined SEO + AEO score, highest first
4. Browse the keyword briefs — first card is expanded by default

### Keywords — Editing a Row
1. Click the **pencil icon** on any card
2. Enter the team PIN when prompted — you won't be asked again for the rest of the session
3. A drawer opens on the right with all editable fields
4. Update **Status**, **Title**, **Keywords**, **Persona**, **Angle**, etc.
5. Click **Save Row** — changes are written back to the Google Sheet instantly

### Keywords — Generated Blog Posts Tab
A virtual tab at the end of the tab bar aggregates all rows with `status=generated` across every product tab for the active domain, sorted latest-first by generation date. Cards in this tab are read-only (no edit button).

### Optimization Agent — Browsing
1. Select a **domain** from the top nav
2. Click **Optimization Agent** in the sidebar
3. **Pending Optimization** tab shows posts not yet optimized, sorted by original sheet order — click any column header to sort
4. **Optimized Posts** tab shows posts already optimized with their last-optimized date
5. Use product filter chips or the URL search box to narrow results
6. Click **#** column header at any time to restore original sheet order
7. Click the external link icon on any row to open the post in a new tab

### Translation Agent — Browsing
1. Select a **domain** from the top nav
2. Click **Translation Agent** in the sidebar
3. **Missing Translations** tab shows posts still missing at least one language for the active domain
4. **History** tab shows every tracked post's status (`pending` / `partial` / `completed`) for the active domain
5. Use the language dropdown to find posts missing a specific language, or the product chips / search box to narrow further
6. Click the external link icon on any row to open the post in a new tab

### URL Validator — Running a Scan
1. Select a **domain** from the top nav
2. Click **URL Validator** in the sidebar
3. If `URL_VALIDATOR_CONTENT_DIR_*` is set for that domain, click **Run Scan**
4. Watch progress per product in real time
5. Results are written to Google Sheets and displayed immediately

### CI/CD Status — Browsing
1. Select a **domain** from the top nav
2. Click **CI/CD Status** in the sidebar
3. Deployment cards at the top show the latest production/staging run per provider
4. Use the env/provider filter chips and per-workflow chips to narrow the run history table below
5. Click a failed run's row to expand its failed job/step detail (fetched on demand)

### Repo Doctor — Scanning and Fixing
1. Select a **domain** from the top nav
2. Click **Repo Doctor** in the sidebar
3. Click **Run Scan** (or wait for the weekly cron / on-commit webhook, for domains that have one) — issues appear as cards, each with the literal file line, a plain-English explanation, and a suggested fix
4. Click **Fix It** on a fixable issue to preview the exact before/after diff — nothing is written yet
5. Click **Confirm & Open PR** to actually open the fix as a pull request, or **Cancel** to back out
6. Review and merge the PR on GitHub like any other — Repo Doctor never merges it for you
7. Switch to the **Fixed** tab to see every confirmed fix's history, each linking to its PR

### Special Tabs
- **All Missing Topics** — a real sheet tab; not supported in the card view. Click **Open in Google Sheets** on the message page to review it directly.
- **Generated Blog Posts** — a virtual tab (not a real sheet tab); aggregates all `status=generated` rows across all products, sorted latest-first. Read-only.

---

## Local Development

### Prerequisites

- Node.js 18+
- A Google Cloud service account with Editor access to the relevant Google Sheets

### Setup

1. Clone the repo and navigate to the project:

```bash
git clone https://github.com/conholdate/blog-agents-platform.git
cd blog-agents-platform/dashboard
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment file and fill in the values:

```bash
cp .env.local.example .env.local
```

4. Open `.env.local` and configure:

```env
# Google Service Account (shared across all tools)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}

# Keyword Agent — one Sheet ID per domain
KEYWORD_AGENT_SHEET_ID_ASPOSE_COM=
KEYWORD_AGENT_SHEET_ID_ASPOSE_CLOUD=
KEYWORD_AGENT_SHEET_ID_GROUPDOCS_COM=
KEYWORD_AGENT_SHEET_ID_GROUPDOCS_CLOUD=
KEYWORD_AGENT_SHEET_ID_CONHOLDATE_COM=
KEYWORD_AGENT_SHEET_ID_CONHOLDATE_CLOUD=

# URL Validator — one Sheet ID + content directory per domain
# Sheet ID: the long string in the Google Sheets URL: docs.google.com/spreadsheets/d/SHEET_ID/edit
URL_VALIDATOR_SHEET_ID_ASPOSE_COM=
URL_VALIDATOR_SHEET_ID_ASPOSE_CLOUD=
URL_VALIDATOR_SHEET_ID_GROUPDOCS_COM=
URL_VALIDATOR_SHEET_ID_GROUPDOCS_CLOUD=
URL_VALIDATOR_SHEET_ID_CONHOLDATE_COM=
URL_VALIDATOR_SHEET_ID_CONHOLDATE_CLOUD=

# Optimization Agent — shared sheets (tabs named after domains)
SHEET_ID_TO_BE_OPTIMIZED=
SHEET_ID_OPTIMIZATION_LOG=

# Translation Agent — single shared sheet (tabs = domain names + "history")
TRANSLATION_SCAN_SHEET_ID=

# Content dirs — absolute path to each blog's Hugo content folder
# Required to run scans locally; viewing previous results works without these
URL_VALIDATOR_CONTENT_DIR_ASPOSE_COM=
URL_VALIDATOR_CONTENT_DIR_ASPOSE_CLOUD=
URL_VALIDATOR_CONTENT_DIR_GROUPDOCS_COM=
URL_VALIDATOR_CONTENT_DIR_GROUPDOCS_CLOUD=
URL_VALIDATOR_CONTENT_DIR_CONHOLDATE_COM=
URL_VALIDATOR_CONTENT_DIR_CONHOLDATE_CLOUD=

# CI/CD Status — read-only GitHub Actions access, all 6 domains' workflow repos.
# Classic PAT, "repo" scope, used for reads only.
GITHUB_READONLY_TOKEN=

# Repo Doctor — write-scoped GitHub token (branches/commits/PRs). Deliberately
# a SEPARATE token from GITHUB_READONLY_TOKEN above — that one is read-only.
GITHUB_WRITE_TOKEN=

# Repo Doctor — shared secret a content repo's on-commit workflow sends to
# authenticate its webhook call to this dashboard. Only needed for domains
# that opt into on-commit triggering; the weekly cron and manual scans don't
# need it.
REPO_DOCTOR_WEBHOOK_SECRET=

# Repo Doctor — internal OpenAI-compatible "Professionalize" LLM gateway.
# Optional: without these, issue explanations fall back to plain rule-based
# wording instead of AI-phrased text. Detection itself never depends on this.
PROFESSIONALIZE_API_KEY=
PROFESSIONALIZE_BASE_URL=
PROFESSIONALIZE_LLM_MODEL=

# Repo Doctor — spreadsheet the durable "Fix Log" tab is appended to whenever
# a fix PR is opened (created automatically on first write). Optional: fixing
# still works without it, only the durable fix history is skipped.
REPO_DOCTOR_LOG_SHEET_ID=
```

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

The app is deployed on [Vercel](https://vercel.com) and auto-deploys on every push to `main`.

**Vercel settings:**
- Root Directory: `dashboard`
- Framework: Next.js

Set all variables from `.env.local` in:
**Vercel Dashboard → Project → Settings → Environment Variables**

> URL Validator scans require a local content directory and cannot run on Vercel. Viewing previous scan results works from Vercel without any content dir set.

> Repo Doctor's weekly scan and (for opted-in domains) on-commit webhook are GitHub Actions workflows external to Vercel — `.github/workflows/repo-doctor.yml` at the repo root, plus a `repo-doctor-webhook.yml` in a content repo that wants on-commit triggering. Both just `curl` the deployed dashboard's API routes, so they need `DASHBOARD_BASE_URL` set as a GitHub Actions repo **variable** (the production Vercel URL, no trailing slash) — not a Vercel env var.

---

## Google Sheet Structure

### Keyword Agent sheets

Each sheet must have a header row in row 1. The tool reads columns by name, so column order does not matter. Expected column names:

`generated_at_utc`, `run_id`, `status`, `source_sheet_row`, `brand`, `product`, `baseline_platform`, `category`, `sub_category`, `seed_topic`, `selected_platform`, `generated_title`, `primary_keyword`, `secondary_keywords`, `long_tail_keywords`, `semantic_keywords`, `question_keywords`, `entity_keywords`, `primary_keyword_intent`, `primary_keyword_score`, `primary_keyword_aeo_score`, `primary_keyword_placement`, `keyword_clusters`, `rejected_keywords`, `target_persona`, `angle`, `outline`, `editorial_notes`, `markdown_path`

Status values: `queued` · `approved` · `rejected` · `generated`

Multi-value fields (keywords, outline, notes) support:
- Pipe-separated: `value1 | value2 | value3`
- Newline-separated (Alt+Enter in Sheets)

### Optimization Agent sheets

Two shared sheets (each has one tab per domain, named exactly as the domain e.g. `blog.aspose.com`):

**`SHEET_ID_TO_BE_OPTIMIZED`** — posts queued for optimization (populated by the AI agent)

| Column | Description |
|---|---|
| `Page` | Full post URL |
| `Clicks` | Search Console clicks |
| `Impressions` | Search Console impressions |
| `CTR` | Click-through rate (e.g. `1.76%`) |
| `Position` | Average search position |
| `Days Since Published` | Days since the post was published |

**`SHEET_ID_OPTIMIZATION_LOG`** — log of completed optimizations (written by the AI agent)

| Column | Description |
|---|---|
| `URL` | Full post URL |
| `Last Optimized` | Date of last optimization (`YYYY-MM-DD`) |

The `Consolidated` tab in the log sheet also includes a `Domain` column and aggregates all domains.

### Translation Agent sheets

One consolidated sheet (`TRANSLATION_SCAN_SHEET_ID`): one persistent tab per domain (named exactly as the domain, e.g. `blog.aspose.com`) overwritten on each daily scan, plus a shared `history` tab.

**Domain tabs** — current missing-translation snapshot:

| Column | Description |
|---|---|
| `Scan Date` | Date of the scan that produced this row |
| `Domain` | Blog domain |
| `Product` | Product slug (e.g. `barcode`) |
| `Blog Post Directory` | Source post folder name |
| `Blog Post URL` | Full post URL |
| `Author` | Post author |
| `Missing Count` | Number of languages still missing |
| `Missing Translations` | Comma-separated missing language codes |
| `Extra Translations` | Comma-separated orphaned language codes (translation exists but no longer matches a tracked language), or `-` |
| `Extra Files Count` | Count of extra translation files |
| `Status` | Reserved; currently always blank on domain tabs |

**`history` tab** — append-only, shared across all domains:

| Column | Description |
|---|---|
| `Scan Date` | Date of the scan that last touched this row |
| `Domain` | Blog domain |
| `Product` | Product slug |
| `Blog Post Directory` | Source post folder name |
| `Blog Post URL` | Full post URL |
| `Author` | Post author |
| `Missing Translations` | Comma-separated still-missing language codes |
| `Missing Count` | Number of languages still missing |
| `Status` | `pending` (new) / `partial` (some languages done) / `completed` (all done or post removed) |
| `Completed Date` | Date the row reached `completed` |

### URL Validator sheets

Each scan creates two tabs named after the run date:
- **`YYYY-MM-DD`** — full issue list with columns: `#`, `Product`, `Post Folder`, `Language`, `Error Type`, `Current URL`, `Expected URL`, `Notes`, `Redirect Rule`
- **`YYYY-MM-DD – Summary`** — counts by error type, product, and language

### Repo Doctor sheet

One sheet (`REPO_DOCTOR_LOG_SHEET_ID`), one tab (`Fix Log`, created automatically on first fix). Unlike every other agent's sheet, this isn't the primary data source — the live issue list is always read fresh from GitHub (see `scanDomain()`); this tab is purely a durable, browsable history of **confirmed fixes**, appended to once per fix, never on a scan:

| Column | Description |
|---|---|
| `Timestamp` | When the fix was confirmed |
| `Domain` | Blog domain |
| `Issue Type` | One of the six `RepoIssueType` values |
| `Source Key` | The redirect's source path |
| `Before` / `After` | The value before and after the fix (blank `After` means the entry was deleted) |
| `PR URL` / `PR Number` | The pull request the fix was committed to |
| `Raw Line` | The literal `"key": "value"` line from the file before the fix, for context |
| `File` | Which file the issue was in — forward-looking: Repo Doctor scans one file per domain today, but this column means multi-file support won't need a schema migration later |

---

## Tech Stack

- [Next.js 16](https://nextjs.org) — framework (App Router)
- [Tailwind CSS v4](https://tailwindcss.com) — styling with dark mode support
- [Google Sheets API v4](https://developers.google.com/sheets/api) — data source and output
- [Vercel](https://vercel.com) — hosting
