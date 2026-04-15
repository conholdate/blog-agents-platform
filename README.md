# Blog Team Tools

Internal tools for the blog content team.

## Tools

### [keywords-editor](./keywords-editor)
UI for reviewing and editing AI-generated keyword data across Google Sheets.
- Pick domain → pick product tab → review and edit rows
- Edits write back directly to Google Sheets via service account
- Built with Next.js · Deployed on Vercel

## Adding a new tool

1. Create a new folder at the repo root: `mkdir my-new-tool`
2. Build your tool inside it
3. Deploy it separately on Vercel (set **Root Directory** to `my-new-tool/`)
