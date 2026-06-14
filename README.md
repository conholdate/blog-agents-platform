# Blog Agents Platform

The control center for AI agents that automate blog content operations across Aspose, GroupDocs, and Conholdate.

AI agents run autonomously and produce output — keyword briefs, SEO priorities, post drafts, translations. The platform is where the blog team monitors, reviews, and acts on that output across all 6 brand domains.

---

## Agents & Tools

### [Blog Agents Platform](./dashboard) — Web Control Center

**Live:** [Blog Agents Platform](https://blog-agents-platform.vercel.app)

A unified web control center. Each agent has a dedicated section in the left sidebar. Google Sheets is the shared data layer between the agents and the platform.

| Section | Status | What the agent does |
|---|---|---|
| **Overview** | Live | Live stats across all agents — Keyword Agent counts, Optimization Agent priority breakdown, URL Validator issue summary. Click View → to jump to any section |
| **Keyword Agent** | Live | AI agent generates keyword briefs (SEO + AEO scored). Team reviews, approves, or rejects each brief. Approved briefs feed the Post Generation Agent |
| **Post Generation Agent** | Coming Soon | AI agent drafts full blog posts from approved keyword briefs |
| **Translation Agent** | Coming Soon | AI agent translates published posts across languages |
| **Optimization Agent** | Live | AI agent surfaces posts with weak SEO using Search Console data and scores them by priority. Team uses this to decide which posts to refresh |
| **URL Validator** | Live | Scans blog post frontmatter for URL issues. Not an AI agent — a deterministic scanner that catches structural URL errors across all posts |

Built with Next.js · Tailwind CSS · Google Sheets API · Deployed on Vercel

---

### [URL Validator](./url-validator) — Standalone CLI

A Python CLI that runs the same URL scanning logic locally against a checked-out blog repo. Writes colour-coded results to Google Sheets.

Use the CLI for scripted or scheduled runs; use the platform for interactive use.

---

## Repo Structure

```
blog-agents-platform/
├── dashboard/       # Web control center — Next.js app (live on Vercel)
└── url-validator/   # URL Validator — standalone Python CLI (also runs via the platform)
```

---

## Adding a New Agent or Tool

1. Create a new folder at the repo root:
   ```bash
   mkdir my-new-agent
   ```
2. Build the agent or tool inside it
3. Deploy on Vercel — set **Root Directory** to `my-new-agent/` during import
4. Add a sidebar entry in `dashboard/components/dashboard/Sidebar.tsx`
5. Update this README

---

## Repositories

| Remote | URL |
|---|---|
| GitHub | https://github.com/conholdate/blog-agents-platform |
| GitLab | https://gitlab.recruitize.ai/sialkot/lahore-aspose/lahore-blogs-team/blog-agents-platform |
