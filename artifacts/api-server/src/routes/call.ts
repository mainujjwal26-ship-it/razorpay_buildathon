import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { llmConfigured, LlmNotConfiguredError } from "../adapters/llm";
import express from "express";
import { speechConfigured, synthesize, transcribe } from "../adapters/speech";
import { contentVersion, getCustomer, loadCustomers, loadPolicy } from "../lib/content";
import { checkCallingHours } from "../engine/rules";
import { fillBrackets, getFixedLine } from "../engine/script";
import { runTurn, toSpeechVersion, type HistoryItem } from "../engine/turn";
import { sinkConfigured } from "../adapters/logSink";
import { aggregate, liveRecords, metricsOf, qualityReport, reviewOf, sampleRecords, transcriptOf, verdictsOf } from "../engine/analytics";
import { runCodeChecks } from "../engine/codeChecks";
import { incompleteReview, loadChecks, mergeCodeFlags, reviewCall } from "../engine/review";
import { listCalls, logEvent, loggingOn, readCall, renderReport } from "../lib/callLog";

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
    speechConfigured: speechConfigured(),
    callLogging: loggingOn(),
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

    const callId = randomUUID();
    logEvent(callId, "call_start", {
      customerId: customer.id,
      speechMode: speechConfigured() ? "sarvam" : "browser",
      speaker: process.env["SARVAM_SPEAKER"] ?? "ritu",
      pace: process.env["SARVAM_PACE"] ?? "1.2",
      version: contentVersion(),
    });
    logEvent(callId, "agent_line", { say, speak, action: "none", fixedLine: "F1" });
    res.json({ callId, say, speak });
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

    const callId = req.body?.callId;
    const started = Date.now();
    const { reply, raw } = await runTurn(customer, history);
    const parsedOk = raw.trim().startsWith("{") && raw.includes('"say"') && raw.trim().endsWith("}");
    logEvent(callId, "llm_turn", { turn: history.filter((h) => h.role === "agent").length, llmMs: Date.now() - started, rawLength: raw.length, parsedOk });
    logEvent(callId, "agent_line", {
      say: reply.say,
      speak: reply.speak,
      action: reply.action,
      amount: reply.amount,
      reason: reply.reason,
      endCall: reply.endCall,
      raw,
    });

    // Stub for this build: the real payment link arrives with the Razorpay slice.
    const systemNote =
      reply.action === "send_link"
        ? `Payment link for ₹${reply.amount ?? "?"} created and sent (test build, Razorpay not connected). Payment status: pending, not confirmed.`
        : reply.action === "raise_ticket"
          ? `Ticket raised: ${reply.reason ?? "question beyond the customer data"}`
          : null;

    res.json({ ...reply, raw, systemNote });
  } catch (err) {
    logEvent(req.body?.callId, "llm_error", { message: err instanceof Error ? err.message : "Turn failed" });
    const status = err instanceof LlmNotConfiguredError ? 503 : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : "Turn failed" });
  }
});

router.post("/call/transcribe", express.raw({ type: () => true, limit: "10mb" }), async (req, res) => {
  try {
    const audio = req.body as Buffer;
    if (!Buffer.isBuffer(audio) || audio.length === 0) return void res.status(400).json({ error: "No audio received" });
    const callId = req.headers["x-call-id"];
    const started = Date.now();
    try {
      const text = await transcribe(audio, String(req.headers["content-type"] ?? "audio/webm"));
      logEvent(callId, "stt", { ms: Date.now() - started, bytes: audio.length, text });
      res.json({ text });
    } catch (err) {
      logEvent(callId, "stt", { ms: Date.now() - started, bytes: audio.length, error: err instanceof Error ? err.message : "failed" });
      throw err;
    }
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Transcription failed" });
  }
});

router.post("/call/speak", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) return void res.status(400).json({ error: "text is required" });
    const callId = req.body?.callId;
    const started = Date.now();
    try {
      const audio = await synthesize(text);
      logEvent(callId, "tts", { ms: Date.now() - started, chars: text.length });
      res.json({ audio });
    } catch (err) {
      logEvent(callId, "tts", { ms: Date.now() - started, chars: text.length, error: err instanceof Error ? err.message : "failed" });
      throw err;
    }
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Speech failed" });
  }
});

// Browser-side events (mic, speech timing, what was heard). Fire and forget.
router.post("/call/log", (req, res) => {
  const events = Array.isArray(req.body?.events) ? (req.body.events as Record<string, unknown>[]) : [];
  for (const e of events.slice(0, 50)) {
    const { type, ts, ...rest } = e;
    if (typeof type === "string") logEvent(req.body?.callId, type, { ...rest, clientTs: ts });
  }
  res.json({ ok: true });
});

// Test-build log access: list calls, download one as JSON lines (default) or as a readable report (?format=text).
router.get("/call/logs", (_req, res) => res.json({ logging: loggingOn(), pushingToGithub: sinkConfigured(), calls: listCalls() }));
router.get("/call/logs/:id", (req, res) => {
  const call = readCall(req.params["id"]);
  if (!call) return void res.status(404).json({ error: "No log for this call" });
  if (req.query["format"] === "text") {
    res.type("text/plain").send(renderReport(call.events));
    return;
  }
  res.type("application/x-ndjson").set("content-disposition", `attachment; filename="${call.file}"`).send(call.events.map((e) => JSON.stringify(e)).join("\n") + "\n");
});

// ----- After the call: AI review, call list, call detail, team performance -----

router.post("/call/finish", async (req, res) => {
  try {
    const callId = req.body?.callId;
    const call = readCall(callId);
    if (!call) return void res.status(404).json({ error: "No log for this call" });
    if (!reviewOf(call.events)) {
      const start = call.events.find((e) => e["type"] === "call_start");
      const customer = getCustomer(String(start?.["customerId"] ?? ""));
      const transcript = transcriptOf(call.events);
      const talked = transcript.some((l) => l.who === "borrower");
      let review = !customer || !talked ? incompleteReview() : await reviewCall(customer, transcript);
      if (customer && talked) {
        const flags = runCodeChecks(transcript, { emiAmount: customer.emiAmount, minPartPercent: loadPolicy().minPartPaymentPercent, identityConfirmed: review.identityConfirmed });
        review = mergeCodeFlags(review, flags);
      }
      review.version = typeof start?.["version"] === "string" ? start["version"] : undefined;
      logEvent(callId, "call_review", { review });
    }
    res.json({ ok: true });
  } catch (err) {
    logEvent(req.body?.callId, "review_error", { message: err instanceof Error ? err.message : "failed" });
    res.status(500).json({ error: err instanceof Error ? err.message : "Review failed" });
  }
});

router.get("/calls", (_req, res) => res.json({ calls: liveRecords() }));

router.get("/calls/:id", (req, res) => {
  const call = readCall(req.params["id"]);
  if (!call) return void res.status(404).json({ error: "No such call" });
  const start = call.events.find((e) => e["type"] === "call_start");
  const customer = getCustomer(String(start?.["customerId"] ?? ""));
  res.json({
    id: req.params["id"],
    startedAt: start?.["ts"] ?? null,
    customer: customer ?? null,
    transcript: transcriptOf(call.events),
    metrics: metricsOf(call.events),
    review: reviewOf(call.events),
    verdicts: verdictsOf(call.events),
    version: start?.["version"] ?? null,
  });
});

// A person marks a rule-check result right (agree) or wrong (disagree). Used to measure how far the AI reviewer can be trusted.
router.post("/call/verdict", (req, res) => {
  const { callId, checkId, agree } = (req.body ?? {}) as { callId?: unknown; checkId?: unknown; agree?: unknown };
  const call = readCall(callId);
  const known = loadChecks().some((c) => c.id === checkId);
  if (!call || !known || typeof agree !== "boolean") return void res.status(400).json({ error: "callId, checkId and agree are required" });
  logEvent(callId, "human_verdict", { checkId, agree });
  res.json({ ok: true });
});

router.get("/quality", (req, res) => {
  const records = req.query["sample"] === "1" ? [...sampleRecords(), ...liveRecords()] : liveRecords();
  res.json({ includesSample: req.query["sample"] === "1", checks: loadChecks(), ...qualityReport(records) });
});

router.get("/performance", (req, res) => {
  const live = liveRecords();
  const withSample = req.query["sample"] === "1";
  const records = withSample ? [...sampleRecords(), ...live] : live;
  res.json({ includesSample: withSample, checks: loadChecks(), ...aggregate(records) });
});

export default router;
