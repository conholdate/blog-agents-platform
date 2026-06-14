# Claude Code Instructions — Blog Agents Platform

This is the root-level CLAUDE.md for the monorepo. It covers repo-wide rules. For sub-project rules, read:

- [`dashboard/CLAUDE.md`](./dashboard/CLAUDE.md) — before touching anything in `dashboard/`
- [`dashboard/AGENTS.md`](./dashboard/AGENTS.md) — Next.js-specific agent rules

## Repo Structure

```
blog-agents-platform/
├── dashboard/        # Next.js 16 app (live on Vercel) — read dashboard/CLAUDE.md first
└── url-validator/    # Python 3 CLI — blog post URL linter
```

## Critical: Secrets

- **Never read, log, print, or commit** `.env.local`, `.env`, `credentials.json`, or any `*.json` file matching `*service-account*` or `*ai-agents*`
- The file `dashboard/blog-team-ai-agents-*.json` is a live Google service account key — do not open or display it
- Check `.env.local.example` or `credentials.example.json` to understand what env vars are expected

## Dashboard (Next.js)

- Stack: **Next.js 16 App Router · React 19 · Tailwind CSS v4 · TypeScript strict**
- All Google Sheets calls go through `dashboard/lib/sheets.ts` — do not use the Sheets API directly anywhere else
- Domain config (sheet IDs, colors) lives in `dashboard/lib/config.ts` — all domain additions go here
- API routes live under `dashboard/app/api/` — they are all server-side Route Handlers
- Run `npm run lint` inside `dashboard/` before completing any dashboard task
- The app is a **single-page shell** — `app/page.tsx` renders the active section based on state, not route changes

### Dev server
```bash
cd dashboard && npm run dev   # http://localhost:3000
```

## URL Validator (Python)

- Entry point: `url-validator/main.py`
- Tests: `pytest url-validator/test_main.py`
- Rule documentation: `url-validator/VALIDATION_RULES.md`
- Validation logic (the 8 rules) lives in `main.py` — do not split it without a good reason

### Run tests
```bash
cd url-validator && source venv/bin/activate && pytest test_main.py
```

## Style Rules

- No comments explaining *what* the code does — only *why* when non-obvious
- No unused imports, dead code, or backwards-compatibility shims
- No error handling for internal paths that cannot fail
- Do not add features, refactors, or abstractions beyond what the task requires
- TypeScript: no `any` unless unavoidable; prefer explicit types from existing patterns

## Deployment

Vercel auto-deploys `dashboard/` on every push to `main`. No manual deploy step needed. URL Validator is CLI-only and has no deployment.
