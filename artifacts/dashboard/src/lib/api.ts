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

export interface CallConfig {
  agentName: string;
  lenderName: string;
  testMode: boolean;
  withinCallingHours: boolean;
  localTime: string;
  llmConfigured: boolean;
  speechConfigured: boolean;
  callLogging?: boolean;
  customers: Customer[];
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
