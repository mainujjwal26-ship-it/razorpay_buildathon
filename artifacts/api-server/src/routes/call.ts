import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { llmConfigured, LlmNotConfiguredError } from "../adapters/llm";
import { getCustomer, loadCustomers, loadPolicy } from "../lib/content";
import { checkCallingHours } from "../engine/rules";
import { fillBrackets, getFixedLine } from "../engine/script";
import { runTurn, toSpeechVersion, type HistoryItem } from "../engine/turn";

const router: IRouter = Router();

router.get("/call/config", (_req, res) => {
  const policy = loadPolicy();
  const hours = checkCallingHours(new Date(), policy);
  res.json({
    agentName: policy.agentName,
    lenderName: policy.lenderName,
    testMode: policy.testMode,
    withinCallingHours: hours.ok,
    localTime: hours.localTime,
    llmConfigured: llmConfigured(),
    customers: loadCustomers(),
  });
});

router.post("/call/start", async (req, res) => {
  try {
    const customer = getCustomer(String(req.body?.customerId ?? ""));
    if (!customer) return void res.status(404).json({ error: "Unknown customer" });

    const policy = loadPolicy();
    const hours = checkCallingHours(new Date(), policy);
    if (!hours.ok && !policy.testMode) {
      return void res.status(403).json({
        error: `Outside calling hours (${policy.callingHours.start} to ${policy.callingHours.end}). It is ${hours.localTime} in ${policy.callingHours.timezone}.`,
      });
    }

    const f1 = getFixedLine("F1");
    if (!f1) return void res.status(500).json({ error: "Fixed line F1 not found in content/script.md" });
    const say = fillBrackets(f1, { Name: customer.displayName });
    const speak = llmConfigured() ? await toSpeechVersion(say) : say;

    res.json({ callId: randomUUID(), say, speak });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start the call" });
  }
});

router.post("/call/turn", async (req, res) => {
  try {
    const customer = getCustomer(String(req.body?.customerId ?? ""));
    if (!customer) return void res.status(404).json({ error: "Unknown customer" });
    const history = req.body?.history as HistoryItem[] | undefined;
    if (!Array.isArray(history) || history.length === 0) {
      return void res.status(400).json({ error: "history is required" });
    }

    const { reply, raw } = await runTurn(customer, history);

    // Stub for this build: the real payment link arrives with the Razorpay slice.
    const systemNote =
      reply.action === "send_link"
        ? `Payment link for ₹${reply.amount ?? "?"} created and sent (test build, Razorpay not connected). Payment status: pending, not confirmed.`
        : reply.action === "raise_ticket"
          ? `Ticket raised: ${reply.reason ?? "question beyond the customer data"}`
          : null;

    res.json({ ...reply, raw, systemNote });
  } catch (err) {
    const status = err instanceof LlmNotConfiguredError ? 503 : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : "Turn failed" });
  }
});

export default router;
