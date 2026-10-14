<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Per-agent folder convention

`components/dashboard/` and `lib/` are organized one subfolder per agent: `optimization/`, `translation/`, `url-validator/`, `workflows/`, `repo-doctor/`. A new agent or dashboard screen gets its own `components/dashboard/<agent>/` and `lib/<agent>/` — never add files to another agent's subfolder, and never put new agent-specific logic directly in `lib/` or `components/dashboard/` root. The only shared integration points every agent touches are `components/dashboard/Sidebar.tsx` (nav entry) and `components/dashboard/overview/` (the Overview "This Domain" card + "All Domains" table column group). See `ARCHITECTURE.md` for the full current tree.

Keyword Agent is the one exception — it predates this convention and still lives at `lib/sheets.ts` / `lib/config.ts` directly under the root, not in its own subfolder.

## Tests

Run `npm test` (Vitest) before completing any task that touches `lib/workflows/` or `lib/repo-doctor/` — both have real unit test coverage (`workflows.test.ts`, `repo-doctor.test.ts`). `npm run lint` and `npm test` both run in CI (`.github/workflows/ci.yml`) on every push/PR.
