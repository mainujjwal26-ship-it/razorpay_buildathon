import {
  loadAgentTemplate,
  loadGuardrails,
  loadPolicy,
  loadScript,
  loadTalking,
  type Customer,
} from "../lib/content";
import { cleanScriptText } from "./script";

function renderCustomer(c: Customer): string {
  return [
    `- Name: ${c.name} (address as "${c.displayName} ji")`,
    `- EMI amount: ₹${c.emiAmount.toLocaleString("en-IN")}`,
    `- EMI due date: ${c.emiDueDate}; the auto-debit bounced`,
    `- Days past due: ${c.daysPastDue}`,
    `- This is call number ${c.callNumberThisWeek} this week`,
    `- Last call: ${c.lastCall}`,
    `- Earlier promise: ${c.brokenPromise}`,
    `- Language: ${c.language}`,
  ].join("\n");
}

function renderPolicy(): string {
  const p = loadPolicy();
  return [
    `- Lender: ${p.lenderName}`,
    `- Minimum paid now when splitting: ${p.minUpfrontPercent}% of the EMI`,
    `- The balance must be paid before ${p.balanceDueBeforeDpd} days past due`,
    `- A charge waiver is offered only against full payment${p.waiverOnlyOnFullPayment ? "" : " (not enforced)"}`,
    `- At most ${p.maxOfferRounds} offer rounds per call`,
    `- At most ${p.maxCallsPerWeek} calls per week; calling hours ${p.callingHours.start} to ${p.callingHours.end}`,
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
    guardrails: renderGuardrails(),
    talking: renderTalking(),
    script: cleanScriptText(loadScript()),
  };
  return loadAgentTemplate().replace(/\{\{(\w+)\}\}/g, (m, key: string) => slots[key] ?? m);
}
