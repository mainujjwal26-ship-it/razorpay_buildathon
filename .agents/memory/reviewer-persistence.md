---
name: Reviewer persistence
description: Shared review sessions need durable call results, including short answered calls.
---

Use shared, durable storage for call transcripts, summaries, reviews, human verdicts, and analytics inputs. Never silently fall back to instance-local files when that storage fails.

**Why:** The user wants senior people in their friend circle to test a published link and see post-call summaries and analytics reliably across sessions.

**How to apply:** Preserve database-backed persistence when pulling or changing logging. Optional log exports/backups must not become the source of truth. Keep development and production data separate and explain that publishing is not continuous data synchronization.

A short answered call is still a conversation. An AI "incomplete" label must not hide its failed checks from Quality.

**Why:** Browser verification found a persisted review with a failed judgement check excluded from aggregate scores because the AI labelled the short call incomplete.

**How to apply:** Base "no conversation" on actual borrower replies, and score reviews with actual checks rather than excluding them solely by AI outcome.
