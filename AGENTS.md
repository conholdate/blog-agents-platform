# Agent Instructions — Blog Agents Platform

This file provides guidance for AI coding agents (Claude, Codex, Cursor, etc.) working in this monorepo.

## Repo Layout

```
blog-agents-platform/
├── dashboard/        # Next.js 16 web app — Blog Agents Platform UI (live on Vercel)
└── url-validator/    # Python 3 CLI — blog post frontmatter URL linter
```

Each tool is independently deployable and has its own dependencies. **Never cross-import between sub-projects.**

## Sub-project Agent Files

- `dashboard/AGENTS.md` — Next.js-specific agent rules (read before touching dashboard code)
- `dashboard/CLAUDE.md` — Claude Code rules for the dashboard sub-project

Always read the relevant sub-project agent file before making changes inside that folder.

## Environment & Secrets

- `.env.local` and `credentials.json` files exist in sub-projects. **Never read, log, or commit these.**
- The `dashboard/blog-team-ai-agents-*.json` file is a Google service account key. **Do not touch it.**
- Use `.env.local.example` and `credentials.example.json` to understand what env vars are expected.

## General Rules

- Do not install packages at the repo root — install inside the relevant sub-project folder.
- Do not create new files at the repo root unless they are repo-level docs or config (`.github/`, `README.md`, etc.).
- Follow existing code style within each sub-project. Run `npm run lint` in `dashboard/` before marking any dashboard task complete.
- Do not add comments that describe *what* the code does — only add comments when the *why* is non-obvious.
- Do not add error handling or validation for internal paths that cannot fail.

## Common Tasks

### Run dashboard locally
```bash
cd dashboard
npm install
npm run dev
```

### Run URL Validator
```bash
cd url-validator
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Run URL Validator tests
```bash
cd url-validator
pytest test_main.py
```
