export interface Customer {
  id: string;
  name: string;
  displayName: string;
  emiAmount: number;
  emiDueDate: string;
  daysPastDue: number;
  callNumberThisWeek: number;
  lastCall: string;
  brokenPromise: string;
}

export interface FullCustomer extends Customer {
  bounced?: boolean;
  emisPaid?: number;
  lastPayment?: string;
  language?: string;
}

export interface CallConfig {
  agentName: string;
  lenderName: string;
  testMode: boolean;
  withinCallingHours: boolean;
  localTime: string;
  llmConfigured: boolean;
  speechConfigured: boolean;
  callLogging?: boolean;
  customers: FullCustomer[];
}

export type HistoryItem =
  | { role: "agent"; text: string; raw?: string }
  | { role: "borrower"; text: string }
  | { role: "system"; text: string };

export interface TurnReply {
  say: string;
  speak: string;
  action: "none" | "send_link" | "raise_ticket" | "handoff";
  amount: number | null;
  endCall: boolean;
  raw: string;
  systemNote: string | null;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const getCallConfig = () => request<CallConfig>("/call/config");
export const startCall = (customerId: string) =>
  request<{ callId: string; say: string; speak: string }>("/call/start", { customerId });
export const sendTurn = (customerId: string, history: HistoryItem[], callId?: string) =>
  request<TurnReply>("/call/turn", { customerId, history, callId });

/** Test-build call log: fire and forget, never blocks or breaks the call. */
export function logClientEvent(callId: string | undefined, type: string, data: Record<string, unknown> = {}): void {
  if (!callId) return;
  void fetch(`${base}/api/call/log`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callId, events: [{ type, ts: new Date().toISOString(), ...data }] }),
    keepalive: true,
  }).catch(() => undefined);
}
export const callLogUrl = (callId: string, format?: "text") => `${base}/api/call/logs/${callId}${format ? `?format=${format}` : ""}`;

// The call in progress, so speech requests can be tagged in the test log without threading the id through every adapter.
let currentCallId: string | undefined;
export const setCurrentCallId = (id: string | undefined) => {
  currentCallId = id;
};

export async function transcribeAudio(blob: Blob, callId: string | undefined = currentCallId): Promise<string> {
  const res = await fetch(`${base}/api/call/transcribe`, {
    method: "POST",
    headers: { "content-type": blob.type || "audio/webm", ...(callId ? { "x-call-id": callId } : {}) },
    body: blob,
  });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Transcription failed (${res.status})`);
  return data.text ?? "";
}
export const speakText = (text: string, callId: string | undefined = currentCallId) => request<{ audio: string }>("/call/speak", { text, callId });

// ----- Review, call list, performance -----
export type Outcome = "promise_to_pay" | "part_payment" | "link_sent" | "no_commitment" | "refused" | "wrong_person" | "escalated" | "incomplete" | "unreviewed";
export interface CheckResult { id: string; label: string; type: "Hard" | "Judgement"; pass: boolean; note: string | null }
export interface CallReview {
  summary: string;
  outcome: Exclude<Outcome, "unreviewed">;
  reason: string | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  sentiment: "calm" | "worried" | "irritated" | "hostile";
  identityConfirmed: boolean;
  ticketReasons: string[];
  nextStep: string;
  checks: CheckResult[];
}
export interface CallMetrics {
  durationSec: number;
  borrowerTurns: number;
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
export interface CallRow {
  id: string;
  source: "live" | "sample";
  startedAt: string;
  customerName: string;
  durationSec: number;
  borrowerTurns: number;
  replyGapMs: number | null;
  outcome: Outcome;
  sentiment: string | null;
  identityConfirmed: boolean | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  tickets: number;
  checks: { id: string; type: string; pass: boolean }[];
}
export interface CallDetail {
  id: string;
  startedAt: string | null;
  customer: FullCustomer | null;
  transcript: { who: "meera" | "borrower" | "system"; text: string; ts: string }[];
  metrics: CallMetrics;
  review: CallReview | null;
}
export interface Performance {
  includesSample: boolean;
  checks: { id: string; label: string; rule: string; type: string }[];
  totals: { calls: number; reviewed: number; sampleCalls: number; liveCalls: number };
  kpis: {
    identityConfirmedPct: number | null;
    promiseToPayPct: number | null;
    guardrailPassPct: number | null;
    callsWithHardFailPct: number | null;
    replyGapMs: number | null;
    avgDurationSec: number | null;
    ticketsPer100: number | null;
    promisedAmount: number;
  };
  outcomes: Record<string, number>;
  sentiments: Record<string, number>;
  weakestChecks: { id: string; fails: number; total: number; type: string }[];
  trend: { date: string; calls: number; guardrailPassPct: number | null; replyGapMs: number | null }[];
}
export const finishCall = (callId: string) => request<{ ok: boolean }>("/call/finish", { callId });
export const getCalls = () => request<{ calls: CallRow[] }>("/calls");
export const getCallDetail = (id: string) => request<CallDetail>(`/calls/${id}`);
export const getPerformance = (sample: boolean) => request<Performance>(`/performance?sample=${sample ? 1 : 0}`);
