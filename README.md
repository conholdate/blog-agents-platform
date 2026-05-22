# Blog Team Tools

A monorepo of internal tools built for the Blog Team at Aspose, GroupDocs, and Conholdate.

---

## Tools

### [Blog Team Dashboard](./dashboard)

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

A multi-tool web dashboard for the blog team across all 6 brand domains. Each tool is a dedicated section in the left sidebar.

| Section | Status | Description |
|---|---|---|
| **Overview** | Live | Progress summary for the active domain — keyword stats, quick navigation to each tool |
| **Keyword Agent** | Live | Review and edit AI-generated keyword briefs; 3-column layout (queued/rejected/approved); adaptive card grid; colour-coded SEO/AEO scores; PIN-protected editing; Generated Blog Posts tab |
| **URL Validator** | Live | Run URL validation scans and view colour-coded results; per-domain Google Sheets output |
| **Translation Agent** | Coming Soon | Track translation status per product and language |
| **Optimization Agent** | Coming Soon | Queue and track SEO optimization of existing posts |
| **Post Generation Agent** | Coming Soon | Generate full blog post drafts from keyword briefs using AI agents |

Built with Next.js · Tailwind CSS · Google Sheets API · Deployed on Vercel

---

### [URL Validator](./url-validator)

A standalone Python CLI that scans all blog post frontmatter for URL issues and writes colour-coded reports to Google Sheets. The same validation logic is also available directly from the Dashboard UI (URL Validator section).

Use the CLI for scripted or offline runs; use the dashboard for interactive use.

---

## Repo Structure

```
blog-team-tools/
├── dashboard/       # Blog Team Dashboard — multi-tool web app (live on Vercel)
└── url-validator/   # URL Validator — standalone Python CLI (also integrated into dashboard)
```

---

## Adding a New Tool

1. Create a new folder at the repo root:
   ```bash
   mkdir my-new-tool
   ```
2. Build the tool inside it
3. Deploy on Vercel — set **Root Directory** to `my-new-tool/` during import
4. Add a sidebar entry in `dashboard/components/dashboard/Sidebar.tsx`
5. Update this README

---

## Repositories

| Remote | URL |
|---|---|
| GitHub | https://github.com/conholdate/blog-team-tools |
| GitLab | https://gitlab.recruitize.ai/sialkot/lahore-aspose/lahore-blogs-team/blog-team-tools |
