import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pool } from "../../lib/db/src/index";
import { logEvent, readCall, listCalls, withReviewLock } from "../../artifacts/api-server/src/lib/callLog";
import { liveRecords, reviewOf, qualityReport } from "../../artifacts/api-server/src/engine/analytics";
import { loadCustomers } from "../../artifacts/api-server/src/lib/content";

test("shared events, summary and analytics survive a fresh process; retries do not duplicate data", async () => {
  const id = `persistence-test-${randomUUID()}`;
  try {
    // The test deliberately avoids optional GitHub backups.
    await logEvent(id, "call_start", { customerId: loadCustomers()[0]!.id });
    const eventId = randomUUID();
    await logEvent(id, "persistence_probe", { text: "shared event", callId: "spoofed", type: "spoofed" }, eventId);
    await logEvent(id, "persistence_probe", { text: "shared event" }, eventId);
    const now = new Date();
    const review = { summary: "Persistent test review", nextStep: "Test only", outcome: "no_commitment", checks: [], sentiment: "calm", identityConfirmed: true, ticketReasons: [] };
    for (let i = 0; i < 2; i++) {
      for (const type of ["call_end", "call_review"]) {
        await pool.query("INSERT INTO call_events(call_id,type,occurred_at,event) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [id, type, now, JSON.stringify({ type, ts: now.toISOString(), callId: id, ...(type === "call_review" ? { review } : {}) })]);
      }
    }
    const call = await readCall(id);
    assert.ok(call);
    assert.equal(call.events.filter((e) => e.type === "persistence_probe").length, 1);
    assert.equal(call.events.filter((e) => e.type === "call_review").length, 1);
    assert.equal(call.events.filter((e) => e.type === "call_end").length, 1);
    assert.equal(call.events[1]!.callId, id);
    assert.ok((await listCalls()).some((c) => c.id === id));
    assert.equal((await liveRecords()).find((c) => c.id === id)?.outcome, "no_commitment");
    const modulePath = fileURLToPath(new URL("../../artifacts/api-server/src/lib/callLog.ts", import.meta.url));
    const dbPath = fileURLToPath(new URL("../../lib/db/src/index.ts", import.meta.url));
    const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "-e",
      `(async()=>{const {readCall}=await import(${JSON.stringify(modulePath)}); const {pool}=await import(${JSON.stringify(dbPath)}); const c=await readCall(${JSON.stringify(id)}); console.log(JSON.stringify(c.events.find(e=>e.type==='call_review').review.summary)); await pool.end();})().catch(()=>process.exit(1));`,
    ], { encoding: "utf8", timeout: 20000 });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), '"Persistent test review"');
  } finally {
    // Only delete this test's unique fixture, never real calls.
    await pool.query("DELETE FROM call_events WHERE call_id=$1", [id]);
  }
});

test("cross-instance review lock excludes concurrent work and releases after errors", async () => {
  const id = `lock-test-${randomUUID()}`;
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const first = withReviewLock(id, async () => { entered(); await waiting; });
  await started;
  try {
    assert.equal(await withReviewLock(id, async () => { assert.fail("Concurrent review ran"); }), false);
  } finally {
    release();
  }
  assert.equal(await first, true);
  await assert.rejects(withReviewLock(id, async () => { throw new Error("Expected test failure"); }), /Expected test failure/);
  assert.equal(await withReviewLock(id, async () => {}), true);
});

test("a short answered call keeps its failed quality checks even if AI labels it incomplete", () => {
  const review = reviewOf([
    { type: "borrower_reply", text: "Yes, I can pay tomorrow." },
    { type: "call_review", review: { outcome: "incomplete", checks: [{ id: "close", type: "Judgement", pass: false }] } },
  ]);
  assert.equal(review?.outcome, "no_commitment");
  const report = qualityReport([{
    id: "short-call", source: "live", startedAt: new Date().toISOString(),
    customerName: "Test customer", durationSec: 38, borrowerTurns: 1,
    replyGapMs: 7400, outcome: review!.outcome, sentiment: "calm",
    identityConfirmed: true, promiseDate: null, promiseAmount: null,
    tickets: 0, version: "test", checks: review!.checks,
  }]);
  assert.equal(report.totals.scored, 1);
  assert.equal(report.core.judgementPassPct, 0);
});

test.after(async () => { await pool.end(); });
