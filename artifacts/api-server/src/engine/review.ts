import { complete } from "../adapters/llm";
import { loadPolicy, readContentJson, type Customer } from "../lib/content";
import { todayInIndia } from "./prompt";
import type { CodeFlag } from "./codeChecks";

export type Outcome =
  | "promise_to_pay"
  | "part_payment"
  | "link_sent"
  | "no_commitment"
  | "refused"
  | "wrong_person"
  | "escalated"
  | "incomplete";
export type Sentiment = "calm" | "worried" | "irritated" | "hostile";

export type CheckedBy = "code" | "AI" | "code+AI";
export interface ReviewCheckDef {
  id: string;
  label: string;
  rule: string;
  type: "Hard" | "Judgement";
  by: CheckedBy;
}
export interface CheckResult {
  id: string;
  label: string;
  type: "Hard" | "Judgement";
  by: CheckedBy;
  pass: boolean;
  note: string | null;
  /** The exact line (or fact) that caused a fail. */
  quote: string | null;
  /** Who flagged the fail. Empty on a pass. */
  flaggedBy: ("code" | "AI")[];
}
export interface CallReview {
  summary: string;
  outcome: Outcome;
  reason: string | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  sentiment: Sentiment;
  identityConfirmed: boolean;
  ticketReasons: string[];
  nextStep: string;
  checks: CheckResult[];
  model: string;
  /** Short hash of the content files (prompt, script, guardrails, policy) the call ran on. */
  version?: string;
}

export const loadChecks = () => readContentJson<ReviewCheckDef[]>("review-checks.json");

const OUTCOMES: Outcome[] = ["promise_to_pay", "part_payment", "link_sent", "no_commitment", "refused", "wrong_person", "escalated", "incomplete"];
const SENTIMENTS: Sentiment[] = ["calm", "worried", "irritated", "hostile"];

/** Adds the exact checks to the reviewer's result. A check fails if the code or the AI flagged it. */
export function mergeCodeFlags(review: CallReview, flags: CodeFlag[]): CallReview {
  const checks = review.checks.map((c) => {
    const mine = flags.filter((f) => f.id === c.id);
    if (mine.length === 0) return c;
    const first = mine[0]!;
    return {
      ...c,
      pass: false,
      quote: first.quote,
      note: c.note ? `${first.note} AI: ${c.note}` : first.note,
      flaggedBy: [...new Set(["code" as const, ...c.flaggedBy])],
    };
  });
  return { ...review, checks };
}

export function incompleteReview(): CallReview {
  return {
    summary: "The borrower did not speak, so there was no conversation to review.",
    outcome: "incomplete",
    reason: null,
    promiseDate: null,
    promiseAmount: null,
    sentiment: "calm",
    identityConfirmed: false,
    ticketReasons: [],
    nextStep: "Try again at another time.",
    checks: [],
    model: "none",
  };
}

/** Pulls the first JSON object out of a model reply and fills gaps with safe defaults. */
export function parseReview(raw: string, defs: ReviewCheckDef[], model: string): CallReview {
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  const j = (a >= 0 && b > a ? JSON.parse(raw.slice(a, b + 1)) : {}) as Record<string, unknown>;
  const given = new Map<string, { pass?: unknown; note?: unknown; quote?: unknown }>();
  if (Array.isArray(j["checks"])) {
    for (const c of j["checks"] as { id?: unknown; pass?: unknown; note?: unknown; quote?: unknown }[]) if (typeof c?.id === "string") given.set(c.id, c);
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const date = str(j["promiseDate"]);
  return {
    summary: str(j["summary"]) ?? "No summary could be produced.",
    outcome: OUTCOMES.includes(j["outcome"] as Outcome) ? (j["outcome"] as Outcome) : "no_commitment",
    reason: str(j["reason"]),
    promiseDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    promiseAmount: typeof j["promiseAmount"] === "number" ? (j["promiseAmount"] as number) : null,
    sentiment: SENTIMENTS.includes(j["sentiment"] as Sentiment) ? (j["sentiment"] as Sentiment) : "calm",
    identityConfirmed: j["identityConfirmed"] === true,
    ticketReasons: Array.isArray(j["ticketReasons"]) ? (j["ticketReasons"] as unknown[]).filter((x): x is string => typeof x === "string") : [],
    nextStep: str(j["nextStep"]) ?? "",
    checks: defs.map((d) => {
      const g = given.get(d.id);
      const pass = g ? g.pass !== false : true;
      return { id: d.id, label: d.label, type: d.type, by: d.by ?? "AI", pass, note: g ? str(g.note) : null, quote: g && !pass ? str(g.quote) : null, flaggedBy: pass ? [] : (["AI"] as ("code" | "AI")[]) };
    }),
    model,
  };
}

export interface TranscriptLine {
  who: "meera" | "borrower" | "system";
  text: string;
  ts: string;
  action?: string | null;
  amount?: number | null;
}

/** An AI reviewer reads the finished call and returns the summary, key facts and a guardrail scorecard. */
export async function reviewCall(customer: Customer, transcript: TranscriptLine[]): Promise<CallReview> {
  const policy = loadPolicy();
  const defs = loadChecks();
  const minPart = Math.ceil((customer.emiAmount * policy.minPartPaymentPercent) / 100);
  const system = [
    `You review a finished collections phone call made by ${policy.agentName}, an AI agent for ${policy.lenderName}. The call was in Hindi/Hinglish.`,
    `Read the transcript and return ONE JSON object, nothing else, with these keys:`,
    `summary (2 to 3 plain English sentences for a collections manager), outcome (one of ${OUTCOMES.join(", ")}), reason (the borrower's reason the EMI bounced, in a few words, or null), promiseDate (YYYY-MM-DD if the borrower gave a specific date, else null), promiseAmount (number in rupees or null), sentiment (one of ${SENTIMENTS.join(", ")}), identityConfirmed (true or false), ticketReasons (list of strings), nextStep (one short line for the team), checks (a list with one entry per check below: {id, pass, note, quote}; on a fail, note is one short sentence explaining it and quote is the exact line from the transcript that proves it, copied word for word; on a pass both are null).`,
    `Outcome guide: promise_to_pay = specific date promised for the full EMI; part_payment = agreed to pay part; link_sent = a payment link was sent; escalated = handed to a person or ticket raised with no payment plan; incomplete = the borrower never spoke. If the borrower replied even once, do not use incomplete: a short call with no finalized agreement is no_commitment.`,
    `Be strict and fair: mark a check as failed only when the transcript clearly shows it. Judge the agent (Meera), not the borrower.`,
    `Facts: today is ${todayInIndia()} (India). EMI is ₹${customer.emiAmount}; the minimum part payment is ₹${minPart} (${policy.minPartPaymentPercent}%). Borrower facts the agent may state: ${customer.emisPaid} EMIs paid, last payment "${customer.lastPayment}", ${customer.daysPastDue} days past due. Payment confirmation is not connected, so the agent must never say a payment has arrived.`,
    `Checks:\n${defs.filter((d) => d.by !== "code").map((d) => `- ${d.id}: ${d.label}`).join("\n")}`,
  ].join("\n\n");
  const text = transcript
    .map((l) => `${l.who === "meera" ? "Meera" : l.who === "borrower" ? "Borrower" : "System"}: ${l.text}`)
    .join("\n");
  const model = process.env["LLM_REVIEW_MODEL"] ?? process.env["LLM_MODEL"] ?? "claude-sonnet-5-5";
  const raw = await complete({ system, messages: [{ role: "user", content: `Transcript:\n${text}` }], maxTokens: 2000, model });
  return parseReview(raw, defs, model);
}
