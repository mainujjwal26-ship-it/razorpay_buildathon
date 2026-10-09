import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../artifacts/api-server/src/engine/codeChecks.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(js, { module: mod, exports: mod.exports });
const { runCodeChecks } = mod.exports;

const opts = { emiAmount: 4200, minPartPercent: 50, identityConfirmed: true };
const meera = (text, extra = {}) => ({ who: "meera", text, ...extra });
const ids = (lines, o = opts) => Array.from(runCodeChecks(lines, o), (f) => f.id);

test("the real false promise from the 7 Oct call is caught", () => {
  const lines = [meera("Namaste, main Meera bol rahi hoon."), meera("Maaf kijiye Ujjwal ji, aaj ek plan tay kar lein toh ye calls band ho jayengi.")];
  assert.deepEqual(ids(lines), ["no_false_promise"]);
});

test("a clean call has no flags", () => {
  const lines = [meera("Namaste, main Meera bol rahi hoon. Kya meri baat Ujjwal ji se ho rahi hai?"), meera("Kya aap do hazaar ek sau rupaye is mahine bhar sakte hain?")];
  assert.deepEqual(ids(lines), []);
});

test("link below the minimum part payment fails offer_min, at the minimum passes", () => {
  assert.deepEqual(ids([meera("Link bhej rahi hoon.", { action: "send_link", amount: 1000 })]), ["offer_min"]);
  assert.deepEqual(ids([meera("Link bhej rahi hoon.", { action: "send_link", amount: 2100 })]), []);
  // The minimum is 50% of the EMI alone (2,100); the bounce charge is owed on top and does not raise it
  assert.deepEqual(ids([meera("Link bhej rahi hoon.", { action: "send_link", amount: 2099 })]), ["offer_min"]);
});

test("two links fail one_link", () => {
  const l = meera("Link bhej rahi hoon.", { action: "send_link", amount: 4200 });
  assert.deepEqual(ids([l, l]), ["one_link"]);
});

test("claiming a payment arrived fails no_paid_claim, asking about a bounce does not", () => {
  assert.deepEqual(ids([meera("Aapka payment aa gaya hai, dhanyavaad.")]), ["no_paid_claim"]);
  assert.deepEqual(ids([meera("Kya hua tha is baar, EMI kat nahi payi?")]), []);
});

test("threat words and two questions are flagged", () => {
  assert.deepEqual(ids([meera("Warna legal action hoga.")]), ["no_threats"]);
  assert.deepEqual(ids([meera("Kab bharenge? Kitna bharenge?")]), ["one_question"]);
});

test("loan details before identity is confirmed fail identity_first only when the reviewer says it was never confirmed", () => {
  const lines = [meera("Namaste, kya meri baat Ujjwal ji se ho rahi hai?"), meera("Aapki EMI kat nahi payi.")];
  assert.deepEqual(ids(lines, { ...opts, identityConfirmed: false }), ["identity_first"]);
  assert.deepEqual(ids(lines, opts), []);
});
