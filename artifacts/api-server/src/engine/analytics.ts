import { listCalls, readCall } from "../lib/callLog";
import { readContentJson, loadCustomers } from "../lib/content";
import type { CallReview, Outcome, Sentiment, TranscriptLine } from "./review";

type Ev = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export interface CallMetrics {
  durationSec: number;
  borrowerTurns: number;
  /** Time from the borrower's reply being sent to Meera starting to speak, averaged. */
  replyGapMs: number | null;
  slowestReplyMs: number | null;
  llmMs: number | null;
  sttMs: number | null;
  ttsMs: number | null;
  silences: number;
  micToggles: number;
  errors: number;
  speechMode: string;
  actions: { sendLink: number; raiseTicket: number; handoff: number };
}

export function transcriptOf(events: Ev[]): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  for (const e of events) {
    const ts = String(e["ts"] ?? "");
    if (e["type"] === "agent_line" && typeof e["say"] === "string") out.push({ who: "meera", text: e["say"], ts });
    else if (e["type"] === "borrower_reply" && typeof e["text"] === "string") out.push({ who: "borrower", text: e["text"], ts });
    else if (e["type"] === "agent_line" || e["type"] === "borrower_reply") continue;
  }
  return out;
}

export function metricsOf(events: Ev[]): CallMetrics {
  const t = (e: Ev) => Date.parse(String(e["ts"] ?? "")) || 0;
  const start = events.find((e) => e["type"] === "call_start");
  const last = [...events].reverse().find((e) => e["type"] === "call_end") ?? events[events.length - 1];
  const gaps: number[] = [];
  let sent = 0;
  for (const e of events) {
    if (e["type"] === "borrower_reply") sent = t(e);
    else if (e["type"] === "speak_start" && sent) {
      gaps.push(t(e) - sent);
      sent = 0;
    }
  }
  const ms = (type: string, key: string) => events.filter((e) => e["type"] === type).map((e) => num(e[key])).filter((x): x is number => x !== null);
  const agent = events.filter((e) => e["type"] === "agent_line");
  return {
    durationSec: start && last ? Math.max(0, Math.round((t(last) - t(start)) / 1000)) : 0,
    borrowerTurns: events.filter((e) => e["type"] === "borrower_reply").length,
    replyGapMs: avg(gaps),
    slowestReplyMs: gaps.length ? Math.max(...gaps) : null,
    llmMs: avg(ms("llm_turn", "llmMs")),
    sttMs: avg(ms("stt", "ms")),
    ttsMs: avg(ms("tts", "ms")),
    silences: events.filter((e) => e["type"] === "silence_timeout").length,
    micToggles: events.filter((e) => e["type"] === "mic_on" || e["type"] === "mic_off").length,
    errors: events.filter((e) => ["error", "llm_error", "sink_error"].includes(String(e["type"]))).length,
    speechMode: String(start?.["speechMode"] ?? "browser"),
    actions: {
      sendLink: agent.filter((e) => e["action"] === "send_link").length,
      raiseTicket: agent.filter((e) => e["action"] === "raise_ticket").length,
      handoff: agent.filter((e) => e["action"] === "handoff").length,
    },
  };
}

export const reviewOf = (events: Ev[]): CallReview | null => {
  const r = [...events].reverse().find((e) => e["type"] === "call_review");
  return r ? (r["review"] as CallReview) : null;
};

/** One flat row per call, from a live log or from the sample file. This is what the lists and charts use. */
export interface CallRecord {
  id: string;
  source: "live" | "sample";
  startedAt: string;
  customerName: string;
  durationSec: number;
  borrowerTurns: number;
  replyGapMs: number | null;
  outcome: Outcome | "unreviewed";
  sentiment: Sentiment | null;
  identityConfirmed: boolean | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  tickets: number;
  checks: { id: string; type: "Hard" | "Judgement"; pass: boolean }[];
}

export function liveRecords(): CallRecord[] {
  const name = (id: string) => loadCustomers().find((c) => c.id === id)?.name ?? "Customer";
  const out: CallRecord[] = [];
  for (const c of listCalls()) {
    const call = readCall(c.id);
    if (!call) continue;
    const start = call.events.find((e) => e["type"] === "call_start");
    if (!start) continue;
    const m = metricsOf(call.events);
    const r = reviewOf(call.events);
    out.push({
      id: c.id,
      source: "live",
      startedAt: String(start["ts"]),
      customerName: name(String(start["customerId"] ?? "")),
      durationSec: m.durationSec,
      borrowerTurns: m.borrowerTurns,
      replyGapMs: m.replyGapMs,
      outcome: r?.outcome ?? "unreviewed",
      sentiment: r?.sentiment ?? null,
      identityConfirmed: r ? r.identityConfirmed : null,
      promiseDate: r?.promiseDate ?? null,
      promiseAmount: r?.promiseAmount ?? null,
      tickets: m.actions.raiseTicket,
      checks: (r?.checks ?? []).map((k) => ({ id: k.id, type: k.type, pass: k.pass })),
    });
  }
  return out;
}

export const sampleRecords = (): CallRecord[] => readContentJson<CallRecord[]>("demo/calls.json");

const PROMISED: Outcome[] = ["promise_to_pay", "part_payment", "link_sent"];

export function aggregate(records: CallRecord[]) {
  const reviewed = records.filter((r) => r.outcome !== "unreviewed");
  const talked = reviewed.filter((r) => r.outcome !== "incomplete");
  const identified = talked.filter((r) => r.identityConfirmed);
  const checkRows = talked.flatMap((r) => r.checks);
  const passed = checkRows.filter((c) => c.pass).length;
  const hardFailCalls = talked.filter((r) => r.checks.some((c) => c.type === "Hard" && !c.pass)).length;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

  const outcomes: Record<string, number> = {};
  for (const r of reviewed) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;

  const failById = new Map<string, { id: string; fails: number; total: number; type: string }>();
  for (const c of checkRows) {
    const row = failById.get(c.id) ?? { id: c.id, fails: 0, total: 0, type: c.type };
    row.total += 1;
    if (!c.pass) row.fails += 1;
    failById.set(c.id, row);
  }

  const days = new Map<string, CallRecord[]>();
  for (const r of records) {
    const d = r.startedAt.slice(0, 10);
    days.set(d, [...(days.get(d) ?? []), r]);
  }
  const trend = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rs]) => {
      const checks = rs.flatMap((r) => r.checks);
      const talkedDay = rs.filter((r) => r.checks.length > 0);
      return {
        date,
        calls: rs.length,
        hardFailPct: pct(talkedDay.filter((r) => r.checks.some((c) => c.type === "Hard" && !c.pass)).length, talkedDay.length),
        guardrailPassPct: pct(checks.filter((c) => c.pass).length, checks.length),
        replyGapMs: avg(rs.map((r) => r.replyGapMs).filter((x): x is number => x !== null)),
      };
    });

  return {
    totals: {
      calls: records.length,
      reviewed: reviewed.length,
      sampleCalls: records.filter((r) => r.source === "sample").length,
      liveCalls: records.filter((r) => r.source === "live").length,
    },
    kpis: {
      identityConfirmedPct: pct(identified.length, talked.length),
      promiseToPayPct: pct(identified.filter((r) => PROMISED.includes(r.outcome as Outcome)).length, identified.length),
      guardrailPassPct: pct(passed, checkRows.length),
      callsWithHardFailPct: pct(hardFailCalls, talked.length),
      replyGapMs: avg(records.map((r) => r.replyGapMs).filter((x): x is number => x !== null)),
      avgDurationSec: avg(records.map((r) => r.durationSec)),
      ticketsPer100: talked.length ? Math.round((talked.reduce((s, r) => s + r.tickets, 0) / talked.length) * 100) : null,
      promisedAmount: talked.reduce((s, r) => s + (r.promiseAmount ?? 0), 0),
    },
    outcomes,
    sentiments: talked.reduce<Record<string, number>>((m, r) => ((m[r.sentiment ?? "calm"] = (m[r.sentiment ?? "calm"] ?? 0) + 1), m), {}),
    weakestChecks: [...failById.values()].filter((r) => r.fails > 0).sort((a, b) => b.fails / b.total - a.fails / a.total),
    trend,
  };
}
