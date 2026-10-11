/**
 * The decision layer: joins what the borrower's history says with what they said on this call,
 * and returns one recommended plan plus the reasoning behind it.
 *
 * Plain rules over seven metrics, so every step can be explained, tested and edited
 * (weights live in content/decision-rules.json). The LLM supplies the call facts
 * (reason, promise, cooperation); it does not choose the plan.
 * Kept free of runtime imports so it can be tested on its own.
 */

// ----- Inputs -----
export interface LedgerRow {
  month: string;
  emi: "paid_on_time" | "bounced";
  paidOnDay: number | null;
}
export interface CycleCalls {
  month: string;
  made: number;
  answered: number;
  promise?: { day: number; result: "kept" | "broken" };
}
export interface BorrowerHistory {
  sample?: boolean;
  note?: string;
  profile: { salaryDayFrom: number; salaryDayTo: number; emiDueDay: number };
  ledger: LedgerRow[];
  calls: CycleCalls[];
}
export interface DecisionRules {
  start: number;
  min: number;
  max: number;
  bands: { high: number; medium: number };
  history: {
    bounces: { manyAtLeast: number; manyDelta: number; someAtLeast: number; someDelta: number; fewDelta: number; window: number };
    promiseKept: { goodAtLeastPct: number; goodDelta: number; poorBelowPct: number; poorDelta: number };
    payday: { minBouncesPaid: number; minSharePct: number; delta: number };
    reachable: { goodAtLeastPct: number; goodDelta: number; poorBelowPct: number; poorDelta: number };
  };
  call: {
    specific: { dateAndAmount: number; oneOf: number; neither: number };
    dateFit: { inPaydayWindowDelta: number; graceDaysAfterPayday: number; beforePaydayDelta: number };
    reason: { matchesDelta: number; differsDelta: number };
    cooperation: { cooperative: number; evasive: number; hostile: number };
  };
  field: { minCallsMade: number; maxAnsweredPct: number };
  cost: { aiPerMinute: number; humanPerMinute: number; aiMinutes: number; humanMinutes: number; source: string };
  notBuilt: string[];
}
export type Cooperation = "cooperative" | "evasive" | "hostile";
/** What the call review contributes. */
export interface CallFacts {
  outcome: string;
  rootCause: string | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  cooperation: Cooperation;
}
export interface DecisionInput {
  customer: { emiAmount: number; bounceCharge?: number; displayName?: string };
  history: BorrowerHistory;
  call: CallFacts;
  rules: DecisionRules;
  minPartPercent: number;
}

// ----- Outputs -----
export type ActionKey = "ai_call" | "digital" | "human" | "field" | "none";
export const ACTION_LABEL: Record<ActionKey, string> = {
  ai_call: "AI call",
  digital: "Payment link",
  human: "Person's call",
  field: "Field visit",
  none: "No more effort",
};
export interface HistoryMetrics {
  bouncesInWindow: number;
  windowSize: number;
  bouncedEmisPaid: number;
  bouncedPaidInPaydayWindow: number;
  paydayGapDays: number;
  salaryWindow: [number, number];
  emiDueDay: number;
  promisesTotal: number;
  promisesKept: number;
  callsMade: number;
  callsAnswered: number;
  cycles: number;
}
export interface WalkStep {
  id: string;
  source: "history" | "call";
  label: string;
  detail: string;
  delta: number;
  running: number;
}
export interface PlanStep {
  order: number;
  action: ActionKey;
  title: string;
  when: string;
  why: string;
  kind: "main" | "fallback";
}
export interface Decision {
  metrics: HistoryMetrics;
  walk: WalkStep[];
  prior: { score: number; band: Band };
  result: { score: number; band: Band };
  plan: {
    headline: string;
    steps: PlanStep[];
    suggestion: string | null;
    estimatedCostRupees: number | null;
    costNote: string;
    amountAtStake: number;
  } | null;
  blocked: string | null;
  callAlone: { action: ActionKey; text: string };
  withHistory: { action: ActionKey | null; text: string };
  changed: boolean;
  /** Plain-language reason history changed (or did not change) the decision. */
  because: string;
  usedCallEvidence: boolean;
  notBuilt: string[];
}
export type Band = "High" | "Medium" | "Low";

// ----- Helpers -----
const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const bandOf = (score: number, r: DecisionRules): Band => (score >= r.bands.high ? "High" : score >= r.bands.medium ? "Medium" : "Low");
const dayOf = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.slice(8, 10)) : null);
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
const ROOT_CAUSE_TEXT: Record<string, string> = {
  timing: "salary arrives after the EMI date",
  one_off_expense: "a one-off expense",
  hardship: "a lasting loss of income",
  forgot_or_autodebit: "forgot, or the auto-debit failed",
  how_to_pay: "did not know how to pay",
  dispute: "disputes the loan or a charge",
  declined_to_say: "chose not to say",
  unclear: "the reason stayed unclear",
};

export function deriveHistory(h: BorrowerHistory, r: DecisionRules): HistoryMetrics {
  const { salaryDayFrom: from, salaryDayTo: to, emiDueDay } = h.profile;
  const last = h.ledger.slice(-r.history.bounces.window);
  const bounced = h.ledger.filter((l) => l.emi === "bounced" && l.paidOnDay !== null);
  const promises = h.calls.map((c) => c.promise).filter((p): p is NonNullable<CycleCalls["promise"]> => Boolean(p));
  return {
    bouncesInWindow: last.filter((l) => l.emi === "bounced").length,
    windowSize: last.length,
    bouncedEmisPaid: bounced.length,
    bouncedPaidInPaydayWindow: bounced.filter((l) => (l.paidOnDay as number) >= from && (l.paidOnDay as number) <= to).length,
    paydayGapDays: from - emiDueDay,
    salaryWindow: [from, to],
    emiDueDay,
    promisesTotal: promises.length,
    promisesKept: promises.filter((p) => p.result === "kept").length,
    callsMade: h.calls.reduce((a, c) => a + c.made, 0),
    callsAnswered: h.calls.reduce((a, c) => a + c.answered, 0),
    cycles: h.calls.length,
  };
}

/** The call-alone reading: what a CRM does with a promise today (a callback on that date, or another call). */
function callAloneReading(call: CallFacts, converse: boolean): { action: ActionKey; text: string } {
  if (!converse) return { action: "ai_call", text: "No conversation took place. Call again later." };
  const day = dayOf(call.promiseDate);
  if (day !== null && call.promiseAmount) return { action: "ai_call", text: `Promise noted for the ${ord(day)}. Schedule a callback on that date and wait.` };
  if (day !== null) return { action: "ai_call", text: `Date promised (${ord(day)}), no amount. Schedule a callback on that date.` };
  return { action: "ai_call", text: "No clear commitment. Call again in 2 days and repeat until a positive disposition." };
}

export function decide(input: DecisionInput): Decision {
  const { history: h, call, rules: r, customer, minPartPercent } = input;
  const m = deriveHistory(h, r);
  const converse = call.outcome !== "incomplete" && call.outcome !== "wrong_person";
  const [from, to] = m.salaryWindow;
  const walk: WalkStep[] = [];
  let score = r.start;
  const add = (source: "history" | "call", id: string, label: string, detail: string, delta: number) => {
    if (delta === 0) {
      walk.push({ id, source, label, detail, delta, running: score });
      return;
    }
    score = clamp(score + delta, r.min, r.max);
    walk.push({ id, source, label, detail, delta, running: score });
  };

  // History and profile: the starting expectation.
  const b = r.history.bounces;
  add("history", "bounces", "Bounce record", `${m.bouncesInWindow} of the last ${m.windowSize} EMIs bounced`, m.bouncesInWindow >= b.manyAtLeast ? b.manyDelta : m.bouncesInWindow >= b.someAtLeast ? b.someDelta : b.fewDelta);
  const share = m.bouncedEmisPaid ? (m.bouncedPaidInPaydayWindow / m.bouncedEmisPaid) * 100 : 0;
  const paydayAligned = m.bouncedPaidInPaydayWindow >= r.history.payday.minBouncesPaid && share >= r.history.payday.minSharePct;
  add(
    "history",
    "payday",
    "Payday gap",
    `EMI is due on the ${ord(m.emiDueDay)}, salary arrives about the ${ord(from)} to ${ord(to)} (${m.paydayGapDays} days later). ${m.bouncedPaidInPaydayWindow} of ${m.bouncedEmisPaid} bounced EMIs were paid in that window.`,
    paydayAligned ? r.history.payday.delta : 0,
  );
  const keptPct = m.promisesTotal ? (m.promisesKept / m.promisesTotal) * 100 : null;
  const pk = r.history.promiseKept;
  add("history", "promises", "Promises kept", `${m.promisesKept} of ${m.promisesTotal} past promises kept`, keptPct === null ? 0 : keptPct >= pk.goodAtLeastPct ? pk.goodDelta : keptPct < pk.poorBelowPct ? pk.poorDelta : 0);
  const answeredPct = m.callsMade ? (m.callsAnswered / m.callsMade) * 100 : null;
  const rc = r.history.reachable;
  add("history", "reach", "Calls answered", `${m.callsAnswered} of ${m.callsMade} calls answered over ${m.cycles} cycles`, answeredPct === null ? 0 : answeredPct >= rc.goodAtLeastPct ? rc.goodDelta : answeredPct < rc.poorBelowPct ? rc.poorDelta : 0);
  const priorScore = score;
  const prior = { score: priorScore, band: bandOf(priorScore, r) };

  // This call: raises or lowers it.
  if (converse) {
    const day = dayOf(call.promiseDate);
    const sp = r.call.specific;
    const hasDate = day !== null;
    const hasAmount = typeof call.promiseAmount === "number" && call.promiseAmount > 0;
    add(
      "call",
      "specific",
      "Promise specificity",
      hasDate && hasAmount ? `Gave a date (${ord(day as number)}) and an amount (${rupees(call.promiseAmount as number)})` : hasDate ? `Gave a date (${ord(day as number)}) but no amount` : hasAmount ? `Gave an amount but no date` : "Gave no date or amount",
      hasDate && hasAmount ? sp.dateAndAmount : hasDate || hasAmount ? sp.oneOf : sp.neither,
    );
    if (hasDate) {
      const d = r.call.dateFit;
      const inWindow = (day as number) >= from && (day as number) <= to + d.graceDaysAfterPayday;
      const before = (day as number) < from;
      add(
        "call",
        "datefit",
        "Date fits his payday",
        inWindow ? `The ${ord(day as number)} is on or just after his salary window (${ord(from)} to ${ord(to)})` : before ? `The ${ord(day as number)} is before his salary usually arrives (${ord(from)} to ${ord(to)})` : `The ${ord(day as number)} is well after his salary window`,
        inWindow ? d.inPaydayWindowDelta : before ? d.beforePaydayDelta : 0,
      );
    }
    const cause = call.rootCause;
    if (cause && cause !== "declined_to_say" && cause !== "unclear") {
      const matches = cause === "timing";
      add(
        "call",
        "reason",
        "Reason matches his pattern",
        matches ? `Said ${ROOT_CAUSE_TEXT[cause]}, which matches his usual pattern` : `Said ${ROOT_CAUSE_TEXT[cause] ?? cause}, which is not his usual salary-timing pattern`,
        matches ? r.call.reason.matchesDelta : r.call.reason.differsDelta,
      );
    }
    const coop = call.cooperation;
    add("call", "coop", "Cooperation", coop === "cooperative" ? "Engaged and worked towards a plan" : coop === "evasive" ? "Dodged or stayed vague" : "Hostile or refused to engage", r.call.cooperation[coop]);
  }
  const result = { score, band: bandOf(score, r) };

  // ----- Choose the plan -----
  const callAlone = callAloneReading(call, converse);
  if (call.outcome === "wrong_person") {
    return {
      metrics: m, walk, prior, result, plan: null,
      blocked: "Wrong person on the line. Do not act on this call: verify the number before any further contact.",
      callAlone, withHistory: { action: null, text: "No plan. The number needs to be verified first." }, changed: false,
      because: "The call did not reach the borrower, so neither the call nor the history can be applied.", usedCallEvidence: false, notBuilt: r.notBuilt,
    };
  }
  const emi = customer.emiAmount;
  const minPart = Math.ceil((emi * minPartPercent) / 100);
  const charge = customer.bounceCharge ?? 0;
  const promiseDay = dayOf(call.promiseDate);
  const eve = promiseDay !== null ? `The evening before the promised date (${ord(Math.max(1, promiseDay - 1))}, 7 pm)` : "Today";
  const dayWhen = promiseDay !== null ? `the ${ord(promiseDay)}` : "the promised date";
  const chargeNote = charge ? ` The ${rupees(charge)} bounce charge stays owed on top.` : "";
  const steps: PlanStep[] = [];
  let headline = "";
  let suggestion: string | null = null;
  let primary: ActionKey = "digital";
  const answeredLow = answeredPct !== null && m.callsMade >= r.field.minCallsMade && answeredPct <= r.field.maxAnsweredPct;
  const hostile = call.cooperation === "hostile" && converse;
  const sensitive = call.rootCause === "dispute" || call.rootCause === "hardship";

  if (answeredLow) {
    primary = "field";
    headline = "Move to the field team";
    steps.push({ order: 1, action: "human", title: "One last call by a person", when: "Within 24 hours", why: `Only ${m.callsAnswered} of ${m.callsMade} calls were answered, so a conversation is needed before a visit.`, kind: "main" });
    steps.push({ order: 2, action: "field", title: "Assign a field visit", when: "If still unreachable after that call", why: "Calling has stopped working; the field team can reach the borrower in person.", kind: "fallback" });
  } else if (hostile || sensitive || result.band === "Low") {
    primary = "human";
    headline = sensitive && call.rootCause === "dispute" ? "A person should handle this dispute" : sensitive ? "A person should call with a part-payment plan" : hostile ? "A person should take over" : "A person should call within 24 hours";
    const reasonText = sensitive ? `The borrower raised ${ROOT_CAUSE_TEXT[call.rootCause as string]}.` : `Confidence is ${result.band.toLowerCase()} (${result.score}).`;
    steps.push({ order: 1, action: "human", title: "Person's call, listening first", when: "Within 24 hours", why: `${reasonText} A person can negotiate and judge intent better than another automated call.`, kind: "main" });
    if (call.rootCause !== "dispute" && !hostile) steps.push({ order: 2, action: "digital", title: `Send a part-payment link (from ${rupees(minPart)})`, when: "Right after the call, if a plan is agreed", why: `The minimum part payment is ${minPartPercent}% of the EMI.${chargeNote}`, kind: "main" });
    steps.push({ order: steps.length + 1, action: "field", title: "Review for field visit", when: "If nothing is paid in 7 days", why: "Escalate only after a person has tried.", kind: "fallback" });
  } else if (result.band === "Medium") {
    primary = "ai_call";
    headline = promiseDay !== null ? "Confirm the promise with an AI call, then send the link" : "Follow up with an AI call in 2 days";
    steps.push({ order: 1, action: "ai_call", title: "AI call to confirm the plan", when: promiseDay !== null ? `The day before the promised date (${ord(Math.max(1, promiseDay - 1))})` : "In 2 days", why: `Confidence is medium (${result.score}). A short, cheap call keeps the commitment fresh.`, kind: "main" });
    steps.push({ order: 2, action: "digital", title: `Send a payment link for ${rupees(call.promiseAmount ?? emi)}`, when: promiseDay !== null ? `On ${dayWhen}, morning` : "After the call, if he agrees", why: `Makes paying a single tap.${chargeNote}`, kind: "main" });
    steps.push({ order: 3, action: "human", title: "Person's call", when: "If unpaid 2 days after the promised date", why: "A second miss moves the case to a person.", kind: "fallback" });
  } else {
    primary = "digital";
    headline = promiseDay !== null ? `Send a payment link on the evening before the ${ord(promiseDay)}` : "Send a payment link now";
    steps.push({ order: 1, action: "digital", title: `Send a payment link for ${rupees(call.promiseAmount ?? emi)}`, when: eve, why: `Confidence is high (${result.score}). The promise is specific and fits his payday, so no further call is needed.${chargeNote}`, kind: "main" });
    steps.push({ order: 2, action: "ai_call", title: "One AI call", when: "If unpaid a day after the promised date", why: "Only if the link was not used.", kind: "fallback" });
  }
  if (paydayAligned) {
    suggestion = `His EMI falls due ${m.paydayGapDays} days before salary and ${m.bouncedPaidInPaydayWindow} of ${m.bouncedEmisPaid} bounces were cleared right after payday. Ask the lender to move his EMI date to after the ${ord(to)} (lender decision to confirm).`;
  }

  const cost = r.cost;
  const aiCost = cost.aiPerMinute * cost.aiMinutes;
  const humanCost = cost.humanPerMinute * cost.humanMinutes;
  const mainSteps = steps.filter((s) => s.kind === "main");
  const est = mainSteps.reduce((a, s) => a + (s.action === "ai_call" ? aiCost : s.action === "human" ? humanCost : 0), 0);
  const hasField = steps.some((s) => s.action === "field" && s.kind === "main") || primary === "field";

  const withHistoryText = steps[0] ? `${steps[0].title}. ${steps[0].when}.` : "";
  // The call-alone reading is always "call back later". The plan differs unless it is also just a call.
  const changed = primary !== "ai_call";
  let because: string;
  if (!converse) {
    because = "The borrower did not speak, so this plan rests on history alone.";
  } else if (primary === "digital") {
    because = `The call alone only supports waiting for a callback. History shows his bounces are cleared right after payday and this promise fits that, so a callback is wasted effort and a link is enough.`;
  } else if (primary === "human") {
    because = `The call alone supports waiting for a callback. History (${m.promisesKept} of ${m.promisesTotal} promises kept, ${m.bouncesInWindow} of ${m.windowSize} bounces)${call.rootCause && call.rootCause !== "timing" ? " and a reason that is not his usual pattern" : ""} says the commitment cannot be trusted, so a person should step in now.`;
  } else if (primary === "field") {
    because = "Calls have stopped working, which a single call cannot reveal; the call history shows it.";
  } else {
    because = "The call alone supports waiting for a callback. History keeps confidence in the middle, so one short confirming call plus a link is the best use of effort.";
  }

  return {
    metrics: m,
    walk,
    prior,
    result,
    plan: {
      headline,
      steps,
      suggestion,
      estimatedCostRupees: hasField ? null : Math.round(est),
      costNote: cost.source,
      amountAtStake: emi + charge,
    },
    blocked: null,
    callAlone,
    withHistory: { action: primary, text: withHistoryText },
    changed,
    because,
    usedCallEvidence: converse,
    notBuilt: r.notBuilt,
  };
}

export const monthLabel = monthName;
