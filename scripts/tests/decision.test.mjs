import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../artifacts/api-server/src/engine/decision.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(js, { module: mod, exports: mod.exports });
const { decide, deriveHistory, routeOf } = mod.exports;

const rules = JSON.parse(readFileSync(new URL("../../content/decision-rules.json", import.meta.url), "utf8"));
const history = JSON.parse(readFileSync(new URL("../../content/customers/history.json", import.meta.url), "utf8"))["c-ujjwal"];
const customer = { emiAmount: 4200, bounceCharge: 500 };
const run = (call, h = history) => decide({ customer, history: h, call: { outcome: "promise_to_pay", rootCause: null, promiseDate: null, promiseAmount: null, cooperation: "cooperative", ...call }, rules, minPartPercent: 50 });

test("history metrics for the demo borrower", () => {
  const m = deriveHistory(history, rules);
  assert.equal(m.bouncesInWindow, 4);
  assert.equal(m.windowSize, 6);
  assert.equal(m.bouncedEmisPaid, 3);
  assert.equal(m.bouncedPaidInPaydayWindow, 3);
  assert.equal(m.paydayGapDays, 3);
  assert.equal(m.promisesKept, 2);
  assert.equal(m.promisesTotal, 4);
  assert.equal(m.callsMade, 9);
  assert.equal(m.callsAnswered, 9);
});

test("history alone puts him in the middle (prior 55, Medium)", () => {
  const d = run({});
  assert.equal(d.prior.score, 55);
  assert.equal(d.prior.band, "Medium");
});

test("specific promise that fits payday: High confidence, payment link, no call", () => {
  const d = run({ promiseDate: "2026-10-10", promiseAmount: 4200, rootCause: "timing" });
  assert.equal(d.result.band, "High");
  assert.equal(d.result.score, 95);
  assert.equal(d.withHistory.action, "digital");
  assert.equal(d.plan.steps[0].action, "digital");
  assert.ok(d.plan.steps[0].when.includes("9th"));
  assert.ok(d.plan.suggestion.includes("move his EMI date"));
  assert.equal(d.changed, true);
});

test("vague promise and a different reason: Low confidence, a person calls with the part-payment offer", () => {
  const d = run({ outcome: "no_commitment", rootCause: "one_off_expense", cooperation: "evasive" });
  assert.equal(d.result.band, "Low");
  assert.equal(d.plan.steps[0].action, "human");
  assert.ok(d.plan.steps[1].title.includes("₹2,100"));
  assert.equal(d.plan.estimatedCostRupees, 55);
});

test("the same history gives different plans for different calls", () => {
  const a = run({ promiseDate: "2026-10-10", promiseAmount: 4200, rootCause: "timing" });
  const b = run({ outcome: "no_commitment", rootCause: "one_off_expense", cooperation: "evasive" });
  assert.notEqual(a.plan.steps[0].action, b.plan.steps[0].action);
});

test("a promise before payday scores lower than one after it", () => {
  const early = run({ promiseDate: "2026-10-06", promiseAmount: 4200, rootCause: "timing" });
  const fit = run({ promiseDate: "2026-10-10", promiseAmount: 4200, rootCause: "timing" });
  assert.ok(early.result.score < fit.result.score);
});

test("a hostile borrower goes to a person whatever the score", () => {
  const d = run({ promiseDate: "2026-10-10", promiseAmount: 4200, rootCause: "timing", cooperation: "hostile" });
  assert.equal(d.plan.steps[0].action, "human");
});

test("a dispute is never handled by an automated call or link", () => {
  const d = run({ rootCause: "dispute", promiseDate: "2026-10-10", promiseAmount: 4200 });
  assert.equal(d.plan.steps[0].action, "human");
  assert.ok(!d.plan.steps.some((s) => s.action === "digital"));
});

test("many calls and almost none answered moves to the field", () => {
  const h = structuredClone(history);
  h.calls = [{ month: "2026-09", made: 8, answered: 1 }, { month: "2026-10", made: 4, answered: 0 }];
  const d = run({ outcome: "no_commitment" }, h);
  assert.ok(d.plan.steps.some((s) => s.action === "field"));
  assert.equal(d.plan.estimatedCostRupees, null);
});

test("wrong person: no plan", () => {
  const d = run({ outcome: "wrong_person" });
  assert.equal(d.plan, null);
  assert.ok(d.blocked);
});

test("no conversation: plan from history alone, no call steps in the walk", () => {
  const d = run({ outcome: "incomplete" });
  assert.ok(d.walk.every((w) => w.source === "history"));
  assert.equal(d.usedCallEvidence, false);
});

test("score never leaves the allowed range", () => {
  const d = run({ outcome: "refused", cooperation: "hostile", rootCause: "dispute" });
  assert.ok(d.result.score >= rules.min && d.result.score <= rules.max);
});

const routeFor = (call) => routeOf(deriveHistory(history, rules), { outcome: "promise_to_pay", rootCause: null, promiseDate: null, promiseAmount: null, cooperation: "cooperative", ...call }, rules);

test("route: intent shifted goes to a person even when the AI was not let down", () => {
  const r = routeFor({ promiseDate: "2026-10-10", promiseAmount: 4200 });
  assert.equal(r.intentShifted, true);
  assert.equal(r.aiLetDown, false);
  assert.equal(r.to, "human");
});

test("route: a vague call also goes to a person; intent not shifted and a firm promise stays with AI", () => {
  assert.equal(routeFor({ outcome: "no_commitment", cooperation: "evasive" }).aiLetDown, true);
  const calm = { ...history, ledger: history.ledger.map((l) => ({ ...l, emi: "paid_on_time" })) };
  const r = routeOf(deriveHistory(calm, rules), { outcome: "promise_to_pay", rootCause: null, promiseDate: "2026-10-10", promiseAmount: 4200, cooperation: "cooperative" }, rules);
  assert.equal(r.to, "ai");
});
