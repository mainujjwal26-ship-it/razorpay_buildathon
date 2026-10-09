# Sharing the test build

The API stores call events, transcripts, completed AI reviews, human verdicts,
and analytics inputs in PostgreSQL. All API instances read the same database;
local JSONL files and GitHub backups are not required to view results.
Audio is processed for speech recognition/synthesis and is not stored in the database.

## Development

Apply the schema with `pnpm --filter @workspace/db run push`.
To preserve older local call logs, run `node scripts/import-call-logs.mjs` once.
This import is development-only, repeatable, and leaves the original files untouched.
Never add it or schema changes to production startup/build commands.

## Publishing

Replit's Publish flow applies the development schema to its managed production database.
Verify the publishing secrets include `ANTHROPIC_API_KEY` and `SARVAM_API_KEY`.
`GITHUB_LOG_TOKEN` is optional: it enables secondary JSONL backups on the
`call-logs` branch. Backup failures do not affect database-backed results.

Development and production data are separate. Publishing a schema does not
continuously synchronize preview calls to the published app. Reviewers' new
published calls are stored in the production database and contribute to its
Calls, Performance, and Quality screens.

The build remains in test mode; payment links are dummy links. Ritu/Bulbul v3
is unchanged. Calls start with a green, unmuted microphone; browser microphone permission is required.

Call results are shared among visitors, not private per reviewer. Restrict
access in the publishing settings before sharing customer details/transcripts.
After publishing, confirm one complete test call, its review, and analytics
on the published URL. No production deployment is performed by Git pushes.
