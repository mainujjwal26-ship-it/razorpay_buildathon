import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../artifacts/api-server/src/engine/collections.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(js, { module: mod, exports: mod.exports });
const { collectionsMetrics } = mod.exports;

const rec = (o = {}) => ({ outcome: "promise_to_pay", rootCause: "timing", promiseDate: "2026-10-10", promiseAmount: 4200, tickets: 0, ...o });

test("promise needs both a date and an amount", () => {
  const m = collectionsMetrics([rec(), rec({ promiseAmount: null }), rec({ promiseDate: null }), rec({ outcome: "no_commitment", promiseDate: null, promiseAmount: null })]);
  assert.equal(m.promise.clear, 1);
  assert.equal(m.promise.talked, 4);
  assert.equal(m.promise.pct, 25);
});

test("calls where nobody spoke or the wrong person answered are left out of the rates", () => {
  const m = collectionsMetrics([rec(), rec({ outcome: "incomplete" }), rec({ outcome: "wrong_person" }), rec({ outcome: "unreviewed" })]);
  assert.equal(m.talkedCalls, 1);
  assert.equal(m.promise.pct, 100);
});

test("a reason that was declined or unclear is not a clear reason", () => {
  const m = collectionsMetrics([rec(), rec({ rootCause: "declined_to_say" }), rec({ rootCause: "unclear" }), rec({ rootCause: null }), rec({ rootCause: "hardship" })]);
  assert.equal(m.reason.clear, 2);
  assert.equal(m.reason.pct, 40);
});

test("handoff counts in-call handoffs and tickets, plus decision routing, without double counting", () => {
  const m = collectionsMetrics([
    rec({ handoff: true }),
    rec({ tickets: 1, plannedHuman: true }),
    rec({ plannedHuman: true }),
    rec({ outcome: "escalated" }),
    rec(),
  ]);
  assert.equal(m.handoff.inCall, 3);
  assert.equal(m.handoff.routed, 1);
  assert.equal(m.handoff.count, 4);
  assert.equal(m.handoff.pct, 80);
});

test("payment metrics: collected share, resolution rate and median days", () => {
  const pay = (due, paid, resolved, days) => rec({ payment: { due, paid, resolved, daysToResolve: days } });
  const m = collectionsMetrics([pay(4700, 4700, true, 3), pay(4700, 4700, true, 9), pay(4700, 2100, false, null), pay(4700, 0, false, null)]);
  assert.equal(m.collected.paid, 11500);
  assert.equal(m.collected.due, 18800);
  assert.equal(m.collected.pct, 61.2);
  assert.equal(m.resolution.pct, 50);
  assert.equal(m.resolutionDays.median, 6);
});

test("live calls have no payment data, so the payment metrics are null, not zero", () => {
  const m = collectionsMetrics([rec(), rec()]);
  assert.equal(m.collected, null);
  assert.equal(m.resolution, null);
  assert.equal(m.resolutionDays, null);
});

test("no calls at all gives null rates, not NaN", () => {
  const m = collectionsMetrics([]);
  assert.equal(m.promise.pct, null);
  assert.equal(m.handoff.pct, null);
});

test("the demo sample is 100 targeted payments of 5,000 each, 5 lakh in total", () => {
  const sample = JSON.parse(readFileSync(new URL("../../content/demo/calls.json", import.meta.url), "utf8"));
  assert.equal(sample.length, 100);
  assert.ok(sample.every((r) => r.payment.due === 5000));
  const m = collectionsMetrics(sample);
  assert.equal(m.collected.due, 500000);
  assert.ok(m.collected.paid > 0 && m.collected.paid < 500000);
  assert.ok(m.resolutionDays.median > 0, "resolution time is a real number of days");
  // a sent link counts as paid: every paid rupee comes from a link or part-payment outcome
  assert.ok(sample.filter((r) => r.payment.paid > 0).every((r) => ["link_sent", "part_payment"].includes(r.outcome)));
});
