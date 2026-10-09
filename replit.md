# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env for the call section: `ANTHROPIC_API_KEY` (Replit Secrets). Optional: `SARVAM_API_KEY` (Sarvam voice; without it the browser voice is used), `SARVAM_SPEAKER`, `SARVAM_STT_MODEL`, `SARVAM_STT_MODE`, `LLM_MODEL`, `LLM_FAST_MODEL`, `CONTENT_DIR`
- Dashboard (call section): `pnpm --filter @workspace/dashboard run dev`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Call logs (test build)

Every call writes a time-stamped JSON-lines file to `call-logs/` (what Meera said, what was heard, model time, speech-to-text and text-to-speech time, mic taps, silences, errors). After a call, the phone shows "read | download" links. Also: `GET /api/call/logs` lists calls, `GET /api/call/logs/<id>?format=text` gives a readable report. Set `CALL_LOGGING=off` to stop logging, `CALL_LOG_DIR` to change the folder. Logs hold test conversations only; commit them so they can be analysed.

To have logs reach GitHub without committing, add Replit Secrets `GITHUB_LOG_TOKEN` (a fine-grained personal access token for this repo with Contents: read and write). Each call is then pushed to the `call-logs` branch as it happens (change with `GITHUB_LOG_REPO`, `GITHUB_LOG_BRANCH`). Works on a published app too.

## Merchant console (Call, Calls, Performance)

The app has three tabs. **Call**: the phone plus a customer card. **Calls**: every call with an AI review (summary, key data points, rule checks, metrics, transcript). **Performance**: team metrics and charts, with an "Include sample data" switch (44 synthetic calls in `content/demo/calls.json`, clearly labelled). At the end of a call the browser asks the server to review it (`POST /api/call/finish`); the review is stored in the call's log file. The rule checks are listed in `content/review-checks.json`. Env: `LLM_REVIEW_MODEL` to pick the reviewer model.

### Quality tab and trust layer

Tabs are now Call, Calls, Performance (collections metrics) and Quality (trust and evals). Each rule check is done by exact code (`engine/codeChecks.ts`), by the AI reviewer, or both; a flag from either fails the call, and every fail shows the exact quoted line. On each call you can mark a result right or wrong (`POST /api/call/verdict`); the Quality tab shows how often the reviewer agrees with you and counts missed breaches separately. Every call is stamped with a content version (a hash of the prompt, script, guardrails and policy files) so Quality can show results by version. Rules and their "checked by" tag live in `content/review-checks.json`. Tests: `node --test scripts/tests/*.test.mjs`.
