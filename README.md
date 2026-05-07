# Blog Team Tools

A monorepo of internal tools built for the Blog Team at Aspose, GroupDocs, and Conholdate.

---

## Tools

### [Blog Team Dashboard](./dashboard)

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

A multi-tool web dashboard for the blog team across all 6 brand domains. Each tool is a dedicated agent section in the left sidebar.

- **Overview** — progress summary across all agents for the active domain
- **Keyword Agent** — review and edit AI-generated keyword briefs; save back to Google Sheets in real time; reorder rows; PIN-protected editing
- **Translation Agent**, **Optimization Agent**, **Post Generation Agent**, **URL Validator** — coming soon
- Built with Next.js · Tailwind CSS · Google Sheets API · Deployed on Vercel

---

### [URL Validator](./url-validator)

**Status: Development Phase** — not yet ready for production use.

A Python CLI that scans all blog post frontmatter for URL issues (missing URLs, wrong product segments, date-based URLs, translation mismatches, etc.) and writes a colour-coded report to Google Sheets.

---

## Repo Structure

```
blog-team-tools/
├── dashboard/           # Blog Team Dashboard — multi-tool web app (live)
└── url-validator/       # Blog post URL linter — Python CLI (dev phase)
```

Each tool lives in its own folder and is deployed independently on Vercel.

---

## Adding a New Tool

1. Create a new folder at the repo root:
   ```bash
   mkdir my-new-tool
   ```
2. Build the tool inside it
3. Deploy on Vercel — set **Root Directory** to `my-new-tool/` during import
4. Update this README with a description and live link

---

## Repositories

| Remote | URL |
|---|---|
| GitHub | https://github.com/conholdate/blog-team-tools |
| GitLab | https://gitlab.recruitize.ai/sialkot/lahore-aspose/lahore-blogs-team/blog-team-tools |
