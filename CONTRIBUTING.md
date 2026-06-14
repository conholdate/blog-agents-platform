# Contributing

This is the internal **Blog Agents Platform** repo — the control center for AI agents that automate blog content operations across Aspose, GroupDocs, and Conholdate. Maintained by the Blog Team.

## Workflow

This repo uses a **direct-to-main** workflow — commits go straight to `main` and Vercel auto-deploys on every push. There are no feature branches or pull requests required for day-to-day work.

For larger changes (new agents, major refactors), open a PR on the `conholdate` GitHub remote so the diff is reviewable before merge.

## Local Setup

### Dashboard (Next.js)

```bash
cd dashboard
npm install
cp .env.local.example .env.local   # fill in your env vars
npm run dev                         # http://localhost:3000
```

Required env vars are documented in `dashboard/.env.local.example`.

### URL Validator (Python)

```bash
cd url-validator
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp credentials.example.json credentials.json   # fill in your service account key
python main.py
```

## Commit Messages

Follow the existing style seen in `git log`:

```
feat: add bulk status update to keyword agent
fix: race condition when switching domains quickly
refactor: rename SHEET_ID_* env vars to KEYWORD_AGENT_SHEET_ID_*
ui: compact card grid layout improvements
```

Use lowercase, present-tense verbs. No ticket numbers required.

## Code Style

- **Dashboard**: TypeScript strict mode, ESLint (run `npm run lint` before pushing)
- **URL Validator**: PEP 8, pytest for tests (`pytest test_main.py`)
- No new comments unless the *why* is genuinely non-obvious
- No unused imports or dead code

## Adding a New Agent or Tool

1. Create a new folder at the repo root: `mkdir my-new-agent`
2. Build the agent or tool inside it with its own `README.md`, dependencies, and tests
3. Add it to the root `README.md` agents table and `IMPLEMENTATION_PLAN.md`
4. Deploy on Vercel — set **Root Directory** to `my-new-agent/` during import
5. Add a sidebar entry in `dashboard/components/dashboard/Sidebar.tsx`
6. Add env vars to Vercel dashboard

## Secrets & Credentials

- Never commit `.env.local`, `.env`, or any `credentials.json` file
- Google service account keys live in Vercel environment variables (`GOOGLE_SERVICE_ACCOUNT_JSON`)
- PIN for the dashboard editor is set via `NEXT_PUBLIC_EDITOR_PIN` in Vercel

## Remotes

| Remote | URL | Purpose |
|---|---|---|
| `conholdate` | github.com/conholdate/blog-agents-platform | Primary / org remote |
| `origin` | github.com/shoaibkhan-aspose/blog-agents-platform | Personal mirror |
| `gitlab` | gitlab.recruitize.ai/sialkot/lahore-aspose/lahore-blogs-team/blog-agents-platform | Internal GitLab mirror |

Push to `conholdate` (or `origin`) to trigger Vercel deploys.
