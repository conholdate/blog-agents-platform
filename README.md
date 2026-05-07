# Blog Team Tools

A monorepo of internal tools built for the Blog Team at Aspose, GroupDocs, and Conholdate.

---

## Tools

### [Blog Team Dashboard](./dashboard)

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

A multi-tool web dashboard for the blog team, covering keyword briefs, translations, SEO optimization, and URL validation across all 6 brand domains.

- **Overview** — progress summary across all sections for the active domain
- **Keywords** — review and edit AI-generated keyword briefs per product tab; edit fields and save back to Google Sheets in real time; reorder rows with ↑/↓ and save in one batch; PIN-protected editing
- **Translations**, **Optimization**, **URL Validator** — coming soon
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
