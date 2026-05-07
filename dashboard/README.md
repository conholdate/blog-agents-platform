# Blog Team Dashboard

A multi-tool web dashboard for the blog team at Aspose, GroupDocs, and Conholdate. Manage keyword briefs, translations, SEO optimization, post generation, and URL validation — all from one place, across all 6 brand domains.

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

---

## Sections

### Overview
Landing page for the active domain. Shows a Keyword Agent progress card (pending / ok / rejected counts with a per-product progress bar) and placeholder cards for all other agents. Click **View →** on any card to jump straight to that section.

### Keyword Agent
Review and edit AI-generated keyword briefs pulled from Google Sheets. Each brief is displayed as a collapsible card showing:

- **Title** — the AI-generated blog post title
- **Status** — `pending`, `ok`, or `rejected`
- **Keywords** — primary, secondary, long-tail, and semantic (colour-coded by type)
- **Content Brief** — target persona and editorial angle
- **Outline** and **Editorial Notes** — side by side for quick review

Card banners are colour-coded by publishing platform (.NET, Java, Python, C++, Node.js) and fall back to the brand colour when no platform is set.

### Translation Agent / Optimization Agent / Post Generation Agent / URL Validator
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

Switch between domains using the domain pills in the top navigation bar. The active section updates for the selected domain.

---

## How to Use

### Navigation
- Use the **left sidebar** to switch between sections (Overview, Keywords, Translations, Optimization, URL Validator)
- On mobile, tap the **hamburger menu** in the top-left corner to open the sidebar

### Keywords — Browsing
1. Select a **domain** from the top nav
2. Click **Keywords** in the sidebar
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
4. Click **Discard** to revert without touching the sheet

### Editable Fields

| Field | Notes |
|---|---|
| Status | `pending` / `ok` / `rejected` |
| Generated Title | The blog post title |
| Primary Keyword | Main SEO keyword |
| Selected Platform | Target publishing platform |
| Secondary / Long-tail / Semantic Keywords | One item per line |
| Target Persona | Who the post is written for |
| Angle | Editorial hook or approach |
| Outline | One section per line |
| Editorial Notes | Guidance for the writer |

### All Missing Topics Tab
Each sheet contains an **All Missing Topics** tab that is not supported in the card view. Click **Open in Google Sheets** on the message page to review it directly.

---

## Local Development

### Prerequisites

- Node.js 18+
- A Google Cloud service account with access to the relevant Google Sheets

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

4. Open `.env.local` and set:

```env
# Paste the full Google Service Account JSON as a single line
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}

# Google Sheet IDs from each sheet's URL
SHEET_ID_ASPOSE_COM=
SHEET_ID_ASPOSE_CLOUD=
SHEET_ID_GROUPDOCS_COM=
SHEET_ID_GROUPDOCS_CLOUD=
SHEET_ID_CONHOLDATE_COM=
SHEET_ID_CONHOLDATE_CLOUD=
```

> The Sheet ID is the long string in the Google Sheets URL:
> `docs.google.com/spreadsheets/d/**SHEET_ID**/edit`

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

The app is deployed on [Vercel](https://vercel.com) and auto-deploys on every push to `main`.

Set the same variables from `.env.local` in:
**Vercel Dashboard → Project → Settings → Environment Variables**

---

## Google Sheet Structure

Each sheet must have a header row in row 1. The tool reads columns by name, so column order does not matter. Expected column names:

`status`, `generated_title`, `primary_keyword`, `secondary_keywords`, `long_tail_keywords`, `semantic_keywords`, `target_persona`, `angle`, `outline`, `editorial_notes`, `selected_platform`, `product`, `brand`, `category`, `sub_category`, `seed_topic`, `baseline_platform`, `source_sheet_row`, `generated_at_utc`, `run_id`, `markdown_path`

Multi-value fields (keywords, outline, notes) support both formats:
- Pipe-separated: `value1 | value2 | value3`
- Newline-separated (Alt+Enter in Google Sheets): values on separate lines

---

## Tech Stack

- [Next.js 16](https://nextjs.org) — framework
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [Google Sheets API v4](https://developers.google.com/sheets/api) — data source
- [Vercel](https://vercel.com) — hosting
