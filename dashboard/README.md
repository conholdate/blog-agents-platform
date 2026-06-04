# Blog Team Dashboard

A multi-tool web dashboard for the blog team at Aspose, GroupDocs, and Conholdate. Manage keyword briefs, URL validation, translations, SEO optimization, and post generation — all from one place, across all 6 brand domains.

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

---

## Sections

### Overview
Landing page for the active domain. Shows live stats for each active tool and click **View →** to jump directly to any section.

- **Keyword Agent card** — queued / approved / rejected / generated counts + per-product approved/total chips
- **Optimization Agent card** — Pending / High / Medium / Optimized counts + Page 2 Posts / Avg Position / Avg Impressions / Avg CTR
- **URL Validator card** — Total Issues / Products Affected / Scans Run / Last Scan date + top 3 error types with proportional bars
- Coming-soon tools show their description until they go live

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

### Translation Agent / Post Generation Agent
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

### URL Validator — Running a Scan
1. Select a **domain** from the top nav
2. Click **URL Validator** in the sidebar
3. If `URL_VALIDATOR_CONTENT_DIR_*` is set for that domain, click **Run Scan**
4. Watch progress per product in real time
5. Results are written to Google Sheets and displayed immediately

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
git clone https://github.com/conholdate/blog-team-tools.git
cd blog-team-tools/dashboard
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

# Content dirs — absolute path to each blog's Hugo content folder
# Required to run scans locally; viewing previous results works without these
URL_VALIDATOR_CONTENT_DIR_ASPOSE_COM=
URL_VALIDATOR_CONTENT_DIR_ASPOSE_CLOUD=
URL_VALIDATOR_CONTENT_DIR_GROUPDOCS_COM=
URL_VALIDATOR_CONTENT_DIR_GROUPDOCS_CLOUD=
URL_VALIDATOR_CONTENT_DIR_CONHOLDATE_COM=
URL_VALIDATOR_CONTENT_DIR_CONHOLDATE_CLOUD=
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

### URL Validator sheets

Each scan creates two tabs named after the run date:
- **`YYYY-MM-DD`** — full issue list with columns: `#`, `Product`, `Post Folder`, `Language`, `Error Type`, `Current URL`, `Expected URL`, `Notes`, `Redirect Rule`
- **`YYYY-MM-DD – Summary`** — counts by error type, product, and language

---

## Tech Stack

- [Next.js 16](https://nextjs.org) — framework (App Router)
- [Tailwind CSS v4](https://tailwindcss.com) — styling with dark mode support
- [Google Sheets API v4](https://developers.google.com/sheets/api) — data source and output
- [Vercel](https://vercel.com) — hosting
