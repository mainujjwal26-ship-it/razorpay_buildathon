/**
 * Demo mode: one borrower, one call, already answered.
 *
 * Nothing here is a separate product. These are the same payloads the server
 * returns in live mode, written out as fixed sample data, so every screen in
 * the app renders exactly as it does on a real call. The call itself is played
 * back line by line into the same phone, with a note beside each line saying
 * what the agent is doing and why.
 *
 * Switching to Live uses the real server, a real model and a real microphone.
 */
import type { CallConfig, CallDetail, CallRow, CheckResult, Decision } from "./api";

export const DEMO_CALL_ID = "demo-ujjwal";
const DAY = "2026-10-11T19:12:00.000Z";

export interface DemoLine {
  who: "meera" | "borrower";
  text: string;
  /** What this line shows, in the note beside the call. */
  title: string;
  note: string;
}

/** The scripted call. Hinglish, as Meera speaks on a real call. */
export const DEMO_LINES: DemoLine[] = [
  {
    who: "meera",
    text: "Namaste, kya main Ujjwal Goel ji se baat kar rahi hoon?",
    title: "Identity first",
    note: "Meera confirms she has the right person before she says anything about the loan. Until this is answered she may not mention the amount, the date or the bounce.",
  },
  {
    who: "borrower",
    text: "Haan, boliye.",
    title: "Right person confirmed",
    note: "The hard rule identity_first passes. Had this been the wrong person, the call would end here with no loan detail shared.",
  },
  {
    who: "meera",
    text: "Main Meera bol rahi hoon XYZ Finance se. Yeh call record ho rahi hai. Aapki 4,200 rupaye ki EMI 5 tareekh ko bounce ho gayi thi, aur uspar 500 rupaye ka bounce charge laga hai.",
    title: "Only the lender's facts",
    note: "The amount, the date and the charge come from the loan record, not from the model. She also says the call is recorded, which the RBI recovery directions of August 2026 require.",
  },
  {
    who: "borrower",
    text: "Haan, pata hai. Is baar salary late ho gayi thi.",
    title: "The reason, in his own words",
    note: "This is the signal a CRM usually loses. A human agent types a one-word disposition; Meera keeps the sentence and tags it as a salary-timing reason.",
  },
  {
    who: "meera",
    text: "Samajh sakti hoon. Salary kab tak aa jaati hai aapki?",
    title: "Listen before asking for money",
    note: "The judgement rule listened_first expects a question about his situation before any demand. Pressing for payment here would be a breach.",
  },
  {
    who: "borrower",
    text: "9 tareekh tak aa jaati hai.",
    title: "A fact worth keeping",
    note: "Salary lands on the 9th; the EMI falls due on the 5th. That gap is the real cause of the bounce, and it is now on the record.",
  },
  {
    who: "meera",
    text: "Theek hai. Toh kya aap 9 tareekh ko 4,200 rupaye jama kar denge?",
    title: "Ask for a date and an amount",
    note: "A promise without both is not a promise. She proposes his payday itself, the earliest date the money can actually be there, so the promise has a chance of holding.",
  },
  {
    who: "borrower",
    text: "Haan, 9 tareekh ko kar dunga. Par yeh bounce charge maaf ho sakta hai kya?",
    title: "A question outside her authority",
    note: "Waiving a charge is the lender's call. This is the moment where a human agent under target pressure often says yes.",
  },
  {
    who: "meera",
    text: "Charge maaf karne ka faisla main nahi le sakti. Main aapke liye ticket bana deti hoon, team aapko bata degi.",
    title: "She refuses to promise",
    note: "The hard rule no_false_promise holds. Rather than guess, she raises a ticket so a person answers the waiver question. Nothing false enters the record.",
  },
  {
    who: "borrower",
    text: "Theek hai, bana dijiye.",
    title: "Ticket raised",
    note: "The ticket carries his question and the call summary, so whoever picks it up does not start from zero.",
  },
  {
    who: "meera",
    text: "Main aapko payment link bhej rahi hoon. Dohra deti hoon: 4,200 rupaye, 9 tareekh ko. Dhanyavaad.",
    title: "One link, then a read-back",
    note: "Exactly one payment link per call, and the promise is read back so both sides agree on what was said. Next: what the system does with all of this.",
  },
];

const CHECKS: CheckResult[] = [
  { id: "identity_first", label: "Confirmed the right person before any loan detail", type: "Hard", by: "code+AI", pass: true, note: null, quote: null, flaggedBy: [] },
  { id: "no_false_promise", label: "Promised nothing the lender has not approved", type: "Hard", by: "code+AI", pass: true, note: null, quote: null, flaggedBy: [] },
  { id: "no_threats", label: "No threat and no abusive language", type: "Hard", by: "code+AI", pass: true, note: null, quote: null, flaggedBy: [] },
  { id: "facts_only", label: "Stated only the amounts and dates on the loan record", type: "Hard", by: "AI", pass: true, note: null, quote: null, flaggedBy: [] },
  { id: "one_link", label: "Sent the payment link once", type: "Hard", by: "code", pass: true, note: null, quote: null, flaggedBy: [] },
  { id: "listened_first", label: "Asked about his situation before asking for money", type: "Judgement", by: "AI", pass: true, note: null, quote: null, flaggedBy: [] },
  { id: "clean_close", label: "Read the promise back before closing", type: "Judgement", by: "AI", pass: true, note: null, quote: null, flaggedBy: [] },
];

/** The same shape the decision engine returns in live mode, for this call. */
const DECISION: Decision = {
  metrics: { bouncesInWindow: 4, windowSize: 6, callsMade: 9, callsAnswered: 9, promisesKept: 2, promisesTotal: 4 },
  walk: [
    { id: "bounces", source: "history", label: "Bounce record", detail: "4 of the last 6 EMIs bounced", delta: -10, running: 40 },
    { id: "payday", source: "history", label: "Payday gap", detail: "EMI is due on the 5th, salary arrives about the 8th to 10th", delta: 10, running: 50 },
    { id: "promises", source: "history", label: "Promises kept", detail: "2 of 4 past promises kept", delta: 0, running: 50 },
    { id: "reach", source: "history", label: "Calls answered", detail: "9 of 9 calls answered over 4 cycles", delta: 5, running: 55 },
    { id: "specific", source: "call", label: "Promise specificity", detail: "Gave a date (9th) and an amount (₹4,200)", delta: 15, running: 70 },
    { id: "datefit", source: "call", label: "Date fits his payday", detail: "The 9th is the day his salary arrives", delta: 10, running: 80 },
    { id: "reason", source: "call", label: "Reason matches his pattern", detail: "Said salary timing, which matches his usual pattern", delta: 10, running: 90 },
    { id: "coop", source: "call", label: "Cooperation", detail: "Engaged and worked towards a plan", delta: 5, running: 95 },
  ],
  prior: { score: 55, band: "Medium" },
  result: { score: 95, band: "High" },
  plan: {
    headline: "Hand over to a person",
    steps: [],
    suggestion: null,
    estimatedCostRupees: 55,
    costNote: "Reported by a collections analyst in an interview at an Indian lender.",
    amountAtStake: 4700,
  },
  blocked: null,
  callAlone: { action: "ai_call", text: "Schedule a callback on the 9th, the promised date." },
  withHistory: { action: "human", text: "A person should call him within 24 hours." },
  route: {
    intentShifted: true,
    aiLetDown: false,
    to: "human",
    headline: "Hand over to a person",
    why: "4 of the last 6 EMIs bounced, so intent to pay has clearly weakened. The AI was not let down on this call, but waiting for it to be let down again would only add another missed date, so a person should step in now.",
  },
  changed: true,
  because: "The call alone would have scheduled a callback. His bounce record says a person is worth spending on now.",
  usedCallEvidence: true,
  notBuilt: [],
  history: {
    sample: true,
    note: "Sample history for the demo borrower.",
    profile: { salaryDayFrom: 8, salaryDayTo: 10, emiDueDay: 5 },
    ledger: [
      { month: "2026-05", emi: "bounced", paidOnDay: 9 },
      { month: "2026-06", emi: "paid_on_time", paidOnDay: 5 },
      { month: "2026-07", emi: "bounced", paidOnDay: 10 },
      { month: "2026-08", emi: "paid_on_time", paidOnDay: 5 },
      { month: "2026-09", emi: "bounced", paidOnDay: 10 },
      { month: "2026-10", emi: "bounced", paidOnDay: null },
    ],
    calls: [
      { month: "2026-05", made: 2, answered: 2, promise: { day: 9, result: "kept" } },
      { month: "2026-07", made: 3, answered: 3, promise: { day: 8, result: "broken" } },
      { month: "2026-09", made: 2, answered: 2, promise: { day: 10, result: "kept" } },
      { month: "2026-10", made: 2, answered: 2, promise: { day: 10, result: "broken" } },
    ],
  },
};

const CUSTOMER = {
  id: "c-ujjwal",
  name: "Ujjwal Goel",
  displayName: "Ujjwal",
  emiAmount: 4200,
  bounceCharge: 500,
  emiDueDate: "5 October 2026",
  daysPastDue: 6,
  callNumberThisWeek: 3,
  lastCall: "Yesterday",
  brokenPromise: "Promised the 8th in July and did not pay",
  bounced: true,
  emisPaid: 14,
  lastPayment: "₹4,200 on the 10th of last month",
  language: "Hindi",
};

export const DEMO_DETAIL: CallDetail = {
  id: DEMO_CALL_ID,
  startedAt: DAY,
  customer: CUSTOMER,
  transcript: DEMO_LINES.map((l, i) => ({
    who: l.who,
    text: l.text,
    ts: new Date(Date.parse(DAY) + i * 15000).toISOString(),
  })),
  metrics: {
    durationSec: 168,
    borrowerTurns: 5,
    replyGapMs: 2100,
    slowestReplyMs: 3400,
    llmMs: 1100,
    sttMs: 700,
    ttsMs: 900,
    silences: 0,
    micToggles: 0,
    errors: 0,
    speechMode: "sarvam",
    actions: { sendLink: 1, raiseTicket: 1, handoff: 0 },
  },
  review: {
    summary:
      "Ujjwal confirmed his identity and said his salary was late this month; it reaches him by the 9th. He promised ₹4,200 on the 9th and took the payment link. He asked whether the ₹500 bounce charge could be waived, which Meera did not answer; a ticket was raised instead.",
    outcome: "promise_to_pay",
    reason: "Salary was late this month and arrives by the 9th",
    rootCause: "timing",
    promiseDate: "2026-10-09",
    promiseAmount: 4200,
    sentiment: "calm",
    cooperation: "cooperative",
    identityConfirmed: true,
    ticketReasons: ["Asked whether the ₹500 bounce charge can be waived"],
    nextStep: "A person should call him within 24 hours; the waiver question needs an answer from the lender.",
    checks: CHECKS,
  },
  ended: true,
  reviewError: null,
  verdicts: {},
  version: "demo",
  decision: DECISION,
  planStatus: null,
};

export const DEMO_ROW: CallRow = {
  id: DEMO_CALL_ID,
  source: "sample",
  startedAt: DAY,
  customerName: CUSTOMER.name,
  durationSec: 168,
  borrowerTurns: 5,
  replyGapMs: 2100,
  outcome: "promise_to_pay",
  sentiment: "calm",
  identityConfirmed: true,
  promiseDate: "2026-10-09",
  promiseAmount: 4200,
  tickets: 1,
  recommendation: "human",
  checks: CHECKS.map((c) => ({ id: c.id, type: c.type, pass: c.pass })),
};

/** Per screen: whose problem it is, why it matters, and what changes. Shown in both modes. */
export interface Guide { who: string; why: string; problem: string[]; fix: string }
export const GUIDE: Record<string, Guide> = {
  call: {
    who: "Collections head at a lender",
    why: "Every day a bounced EMI waits, it gets harder to recover.",
    problem: ["Calls start days after the bounce", "Every caller says it differently, and rules get broken"],
    fix: "Meera calls within minutes, follows the rules every time, and records the reason and a dated promise.",
  },
  calls: {
    who: "Collections team lead",
    why: "What happened on a call is the input to the next decision.",
    problem: ["Call outcomes sit in notes and spreadsheets", "Analysts spend each day preparing the data"],
    fix: "Every call becomes one row: outcome, promise and a recommendation, with no data preparation.",
  },
  detail: {
    who: "Collections manager deciding who to call next",
    why: "A good call can still hide a borrower who has stopped intending to pay.",
    problem: ["One playbook for every borrower", "Nobody can see why a case went to a person"],
    fix: "Two questions decide AI or person, and the reason is shown.",
  },
  performance: {
    who: "Collections head",
    why: "Money recovered is the number the business is judged on.",
    problem: ["Reports arrive late, built by hand", "Hard to tell if the calling is working"],
    fix: "Recovery, speed and promises kept, read straight from the calls.",
  },
  plan: {
    who: "Collections head planning the cycle",
    why: "A wrong plan is found out only after the cycle has ended.",
    problem: ["The team pre-plans a fixed resource allocation and behaviour", "The gap to target shows up too late to act on"],
    fix: "The AI recommends where AI, callers and reminders go, and what closes the gap, from live results.",
  },
  quality: {
    who: "Risk and compliance head at the lender",
    why: "One rule-breaking call can become a regulator's complaint.",
    problem: ["A quality team hears only a sample of calls", "Fixing the agent is guesswork"],
    fix: "Every call is scored against the rules, so you can see what to tighten in the agent.",
  },
};

/** Used only if the server config cannot be read, so the demo still runs. */
export const DEMO_CONFIG: CallConfig = {
  agentName: "Meera",
  lenderName: "XYZ Finance",
  testMode: true,
  withinCallingHours: true,
  localTime: "",
  llmConfigured: true,
  speechConfigured: false,
  callLogging: false,
  customers: [CUSTOMER],
};
