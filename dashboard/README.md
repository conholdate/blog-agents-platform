# Blog Team Dashboard

A multi-tool web dashboard for the blog team at Aspose, GroupDocs, and Conholdate. Manage keyword briefs, URL validation, translations, SEO optimization, and post generation — all from one place, across all 6 brand domains.

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

---

## Sections

### Overview
Landing page for the active domain. Shows a Keyword Agent progress card (pending / ok / rejected counts with per-product chips) and summary cards for all other tools. Click **View →** on any live card to jump to that section.

### Keyword Agent
Review and edit AI-generated keyword briefs pulled from Google Sheets. Each brief is displayed as a collapsible card showing:

- **Title** — the AI-generated blog post title
- **Status** — `pending`, `ok`, or `rejected`
- **Keywords** — primary, secondary, long-tail, and semantic (colour-coded by type)
- **Content Brief** — target persona and editorial angle
- **Outline** and **Editorial Notes** — side by side for quick review

Card banners are colour-coded by publishing platform (.NET, Java, Python, C++, Node.js) and fall back to the brand colour when no platform is set.

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

### Translation Agent / Optimization Agent / Post Generation Agent
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
3. Select a **product tab** (e.g. Words, Cells, PDF)
4. Browse the keyword briefs — first card is expanded by default

### Keywords — Editing a Row
1. Click the **pencil icon** on any card
2. Enter the team PIN when prompted — you won't be asked again for the rest of the session
3. A drawer opens on the right with all editable fields
4. Update **Status**, **Title**, **Keywords**, **Persona**, **Angle**, etc.
5. Click **Save Row** — changes are written back to the Google Sheet instantly

### Keywords — Reordering Rows
1. Use the **↑ / ↓ arrow buttons** in the card banner to move cards up or down
2. When the order has changed, a **Save Order / Discard** bar appears
3. Click **Save Order** to write the new order to the sheet in one batch

### URL Validator — Running a Scan
1. Select a **domain** from the top nav
2. Click **URL Validator** in the sidebar
3. If `URL_VALIDATOR_CONTENT_DIR_*` is set for that domain, click **Run Scan**
4. Watch progress per product in real time
5. Results are written to Google Sheets and displayed immediately

### All Missing Topics Tab
Each keyword sheet contains an **All Missing Topics** tab that is not supported in the card view. Click **Open in Google Sheets** on the message page to review it directly.

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

`status`, `generated_title`, `primary_keyword`, `secondary_keywords`, `long_tail_keywords`, `semantic_keywords`, `target_persona`, `angle`, `outline`, `editorial_notes`, `selected_platform`, `product`, `brand`, `category`, `sub_category`, `seed_topic`, `baseline_platform`, `source_sheet_row`, `generated_at_utc`, `run_id`, `markdown_path`

Multi-value fields (keywords, outline, notes) support:
- Pipe-separated: `value1 | value2 | value3`
- Newline-separated (Alt+Enter in Sheets)

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
