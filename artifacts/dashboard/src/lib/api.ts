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
  customers: Customer[];
}

export type HistoryItem =
  | { role: "agent"; text: string; raw?: string }
  | { role: "borrower"; text: string }
  | { role: "system"; text: string };

export interface TurnReply {
  say: string;
  speak: string;
  action: "none" | "send_link" | "handoff";
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
export const sendTurn = (customerId: string, history: HistoryItem[]) =>
  request<TurnReply>("/call/turn", { customerId, history });
