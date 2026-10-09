import { db, pool, callEventsTable } from "@workspace/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import { pushLogFile, sinkConfigured } from "../adapters/logSink";
import { logger } from "./logger";

// Persistence is required for summaries/analytics. GitHub remains an optional backup,
// never the source of truth. Database failures must reach the caller.
export const loggingOn = () => true;
export const safeId = (id: unknown): string => String(id ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);

function fileName(callId: string, ts: string): string {
  return `${ts.replace(/[:.]/g, "-").slice(0, 19)}_${callId}.jsonl`;
}

// Push the call's file to GitHub after key events. One push at a time per call; a burst of events becomes one more push.
const syncing = new Map<string, { again: boolean }>();
function syncToGithub(callId: string): void {
  if (!sinkConfigured()) return;
  const running = syncing.get(callId);
  if (running) {
    running.again = true;
    return;
  }
  const state = { again: false };
  syncing.set(callId, state);
  void (async () => {
    try {
      do {
        state.again = false;
        const call = await readCall(callId);
        if (call) await pushLogFile(call.file, call.events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      } while (state.again);
    } catch (err) {
      logger.warn({ callId }, "Optional GitHub call-log backup failed");
    } finally {
      syncing.delete(callId);
    }
  })();
}
const SYNC_ON = new Set(["agent_line", "call_end", "call_review", "human_verdict", "llm_error", "error", "silence_timeout"]);

export async function logEvent(callIdRaw: unknown, type: string, data: Record<string, unknown> = {}, eventId?: string): Promise<void> {
  const callId = safeId(callIdRaw);
  if (!callId) return;
  const ts = new Date();
  const event = { ...data, ts: ts.toISOString(), callId, type };
  await db.insert(callEventsTable).values({ callId, type, occurredAt: ts, event, eventId }).onConflictDoNothing();
  if (SYNC_ON.has(type)) syncToGithub(callId);
}

export async function listCalls(): Promise<{ id: string; file: string; startedAt: string; bytes: number }[]> {
  const rows = await db.select({
    id: callEventsTable.callId,
    startedAt: sql<string>`min(${callEventsTable.occurredAt})`,
    bytes: sql<number>`sum(octet_length(${callEventsTable.event}::text))::integer`,
  }).from(callEventsTable).groupBy(callEventsTable.callId)
    .orderBy(desc(sql`min(${callEventsTable.occurredAt})`));
  return rows.map((r) => ({ ...r, startedAt: new Date(r.startedAt).toISOString(), file: fileName(r.id, new Date(r.startedAt).toISOString()) }));
}

export async function readCall(callIdRaw: unknown): Promise<{ file: string; events: Record<string, unknown>[] } | null> {
  const id = safeId(callIdRaw);
  if (!id) return null;
  const rows = await db.select().from(callEventsTable).where(eq(callEventsTable.callId, id))
    .orderBy(asc(callEventsTable.occurredAt), asc(callEventsTable.sequence));
  if (!rows.length) return null;
  return { file: fileName(id, rows[0]!.occurredAt.toISOString()), events: rows.map((r) => r.event) };
}

// Non-blocking, cross-instance lock; a crashed process releases it automatically.
export async function withReviewLock(callId: string, work: () => Promise<void>): Promise<boolean> {
  const client = await pool.connect();
  let locked = false;
  try {
    const result = await client.query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked", [`review:${callId}`]);
    locked = result.rows[0].locked;
    if (!locked) return false;
    await work();
    return true;
  } finally {
    try {
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [`review:${callId}`]);
    } finally {
      client.release();
    }
  }
}

const clock = (ts: string) => ts.slice(11, 23);

/** Human-readable transcript with times, gaps and what to look at. */
export function renderReport(events: Record<string, unknown>[]): string {
  const out: string[] = [];
  let prev = 0;
  let lastBorrowerEnd = 0;
  for (const e of events) {
    const ts = String(e["ts"] ?? "");
    const t = Date.parse(ts);
    const gap = prev && t ? `+${((t - prev) / 1000).toFixed(1)}s` : "";
    if (t) prev = t;
    const type = String(e["type"]);
    const head = `${clock(ts)} ${gap.padStart(7)}  `;
    switch (type) {
      case "call_start":
        out.push(`${head}CALL START  customer=${e["customerId"]} speech=${e["speechMode"]}`);
        break;
      case "agent_line":
        out.push(`${head}MEERA     ${e["say"]}${e["action"] && e["action"] !== "none" ? `   [action: ${e["action"]}${e["amount"] ? ` ₹${e["amount"]}` : ""}${e["reason"] ? ` — ${e["reason"]}` : ""}]` : ""}${e["endCall"] ? "   [ends call]" : ""}`);
        break;
      case "borrower_reply":
        lastBorrowerEnd = t;
        out.push(`${head}BORROWER  ${e["text"]}   (${e["source"]})`);
        break;
      case "llm_turn":
        out.push(`${head}  model took ${e["llmMs"]} ms${e["rawLength"] ? `, raw ${e["rawLength"]} chars` : ""}${e["parsedOk"] === false ? "  ⚠ reply JSON was malformed, fallback used" : ""}`);
        break;
      case "stt":
        out.push(`${head}  speech-to-text ${e["ms"]} ms, ${e["bytes"]} bytes → "${e["text"] ?? ""}"${e["error"] ? `  ⚠ ${e["error"]}` : ""}`);
        break;
      case "tts":
        out.push(`${head}  text-to-speech ${e["ms"]} ms, ${e["chars"]} chars${e["error"] ? `  ⚠ ${e["error"]}` : ""}`);
        break;
      case "speak_start":
        out.push(`${head}  Meera starts speaking${lastBorrowerEnd && t ? ` (${((t - lastBorrowerEnd) / 1000).toFixed(1)}s after the borrower's reply was sent)` : ""}`);
        break;
      default: {
        const { ts: _ts, callId: _c, type: _t, ...rest } = e;
        out.push(`${head}${type.toUpperCase()} ${Object.keys(rest).length ? JSON.stringify(rest) : ""}`);
      }
    }
  }
  return out.join("\n") + "\n";
}
