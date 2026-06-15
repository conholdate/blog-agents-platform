# Blog Agents Platform

A Human-in-the-Loop (HITL) platform for AI agents that automate blog content operations across Aspose, GroupDocs, and Conholdate.

Each agent runs independently and writes its output to a Google Sheet. The platform lets the team view and edit those Sheets. The edited Sheet is what the next agent reads as its input.

---

## How It Works

All 5 agents are independent. Each writes its output to a Google Sheet. The platform lets the team view and edit those Sheets. The edited Sheet is what the next agent reads as its input.

```
Agent runs  →  writes output to Google Sheet
                        ↓
              Platform: team views and edits the Sheet
                        ↓
              Next agent reads the edited Sheet as input
```

**One intentional gate in the system:** the Keyword Agent brief must be approved by a human before the Post Generation Agent picks it up. The keyword brief is the seed for all downstream content — title, outline, keywords, angle, persona — so human sign-off at this stage is by design. Approval happens in the platform by setting the brief status to `approved`. Every other stage is optional human review.


---

## Agents & Tools

### [Blog Agents Platform](./dashboard) — Web Control Center

**Live:** [Blog Agents Platform](https://blog-agents-platform.vercel.app)

Each agent has a dedicated section in the left sidebar. The platform reads each agent's output Sheet and provides an interface to view, edit, and act on the data.

| Section | Status | Agent output / what the platform shows |
|---|---|---|
| **Overview** | Live | Live stats across all agents and all 6 domains — agent output counts, performance metrics, blog status at a glance |
| **Keyword Agent** | Live | Keyword briefs (SEO + AEO scored). Team views and edits briefs — status, keywords, outline, angle. The edited Sheet is the input for the Post Generation Agent |
| **Post Generation Agent** | Coming Soon | Blog post drafts generated from the Keyword Agent Sheet. Team can review and update before publishing |
| **Translation Agent** | Coming Soon | Translated posts. Team can review translations per product and language |
| **Optimization Agent** | Live | Posts surfaced for SEO refresh, scored by priority using Search Console data. Shows exactly why each post is flagged. A separate agent reads this Sheet to perform the optimization |
| **URL Validator** | Live | URL error scan results across all posts. Run on demand or on a schedule. Not an AI agent — a deterministic scanner that writes findings to a Sheet |

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
