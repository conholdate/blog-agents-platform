# Blog Team Tools

A monorepo of internal tools built for the Blog Team at Aspose, GroupDocs, and Conholdate.

---

## Tools

### [Keywords Editor](./keywords-editor)

**Live:** [blog-team-tools.vercel.app](https://blog-team-tools.vercel.app)

A web app for reviewing and editing AI-generated keyword briefs for technical blog posts.

- Browse briefs across all 6 brand domains (Aspose, GroupDocs, Conholdate + Cloud variants)
- Each brief shows title, status, keywords (primary / secondary / long-tail / semantic), content angle, target persona, outline, and editorial notes
- Edit fields directly and save back to Google Sheets in real time
- PIN-protected editing to prevent accidental changes
- Built with Next.js · Tailwind CSS · Google Sheets API · Deployed on Vercel

---

## Repo Structure

```
blog-team-tools/
└── keywords-editor/     # Keywords brief viewer and editor
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
| GitHub (personal) | https://github.com/shoaibkhan-aspose/blog-team-tools |
| GitHub (org) | https://github.com/conholdate/blog-team-tools |
| GitLab | https://gitlab.recruitize.ai/sialkot/lahore-aspose/lahore-blogs-team/blog-team-tools |
