import {
  amountDue,
  loadAgentTemplate,
  loadGuardrails,
  loadPolicy,
  loadPolicyNotes,
  loadScript,
  loadTalking,
  type Customer,
} from "../lib/content";
import { cleanScriptText } from "./script";

/** Today's date in India, e.g. "Thursday, 8 October 2026". Lets the agent turn "kal" or "parson" into a real date. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(now)
    .replace(/^(\w+),? /, "$1, ");
}

function renderCustomer(c: Customer): string {
  return [
    `- Today: ${todayInIndia()} (India time)`,
    `- Name: ${c.name} (address as "${c.displayName} ji")`,
    `- EMI amount: ₹${c.emiAmount.toLocaleString("en-IN")}`,
    typeof c.bounceCharge === "number"
      ? `- Bounce charge: ₹${c.bounceCharge.toLocaleString("en-IN")}, added to the EMI. Total due now: ₹${amountDue(c).toLocaleString("en-IN")}`
      : `- Bounce charge: a charge applies after a bounce, but the amount is not available. Do not state or guess an amount.`,
    `- EMI due date: ${c.emiDueDate}; the auto-debit bounced`,
    `- Days past due: ${c.daysPastDue}`,
    `- EMIs paid so far: ${c.emisPaid}`,
    `- Last payment: ${c.lastPayment}`,
    `- Language: ${c.language}`,
  ].join("\n");
}

function renderPolicy(): string {
  const p = loadPolicy();
  return [
    `- Lender: ${p.lenderName}`,
    `- Minimum part payment: ${p.minPartPaymentPercent}% of the EMI. The bounce charge stays owed on top of a part payment and is never reduced. No other offers.`,
    `- A charge waiver is not offered (an open point).`,
  ].join("\n");
}

function renderGuardrails(): string {
  return loadGuardrails()
    .map((g) => {
      const items = g.items
        .map((i) => `- ${i.id} [${i.type}] ${i.text}`)
        .join("\n");
      return `### ${g.group}. ${g.name}${g.note ? ` (${g.note})` : ""}\n${items}`;
    })
    .join("\n\n");
}

function renderTalking(): string {
  return Object.entries(loadTalking())
    .filter(([k]) => k !== "version")
    .map(([k, v]) => `- ${k}: ${String(v)}`)
    .join("\n");
}

/** Assembles the agent's instructions from the /content files. No script text lives in code. */
export function buildSystemPrompt(customer: Customer): string {
  const policy = loadPolicy();
  const slots: Record<string, string> = {
    agentName: policy.agentName,
    lenderName: policy.lenderName,
    customer: renderCustomer(customer),
    policy: renderPolicy(),
    policyNotes: loadPolicyNotes(),
    guardrails: renderGuardrails(),
    talking: renderTalking(),
    script: cleanScriptText(loadScript()),
  };
  return loadAgentTemplate().replace(/\{\{(\w+)\}\}/g, (m, key: string) => slots[key] ?? m);
}
