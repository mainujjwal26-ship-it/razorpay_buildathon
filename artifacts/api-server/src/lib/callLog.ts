import fs from "node:fs";
import path from "node:path";
import { pushLogFile, sinkConfigured } from "../adapters/logSink";

/**
 * Test-build call log. One JSON-lines file per call in /call-logs, every event stamped with an ISO time.
 * Used to see where a call went wrong. Turn off with CALL_LOGGING=off. Logging never breaks a call.
 */
function logDir(): string {
  if (process.env["CALL_LOG_DIR"]) return path.resolve(process.env["CALL_LOG_DIR"]);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "content", "policy.json"))) return path.join(dir, "call-logs");
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "call-logs");
}

export const loggingOn = () => (process.env["CALL_LOGGING"] ?? "on").toLowerCase() !== "off";
export const safeId = (id: unknown): string => String(id ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);

function fileFor(callId: string): string {
  const dir = logDir();
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).find((f) => f.endsWith(`_${callId}.jsonl`));
  if (existing) return path.join(dir, existing);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return path.join(dir, `${stamp}_${callId}.jsonl`);
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
        const file = fileFor(callId);
        await pushLogFile(path.basename(file), fs.readFileSync(file, "utf8"));
      } while (state.again);
    } catch (err) {
      logEvent(callId, "sink_error", { message: err instanceof Error ? err.message : "failed" });
    } finally {
      syncing.delete(callId);
    }
  })();
}
const SYNC_ON = new Set(["agent_line", "call_end", "llm_error", "error", "silence_timeout"]);

export function logEvent(callIdRaw: unknown, type: string, data: Record<string, unknown> = {}): void {
  try {
    const callId = safeId(callIdRaw);
    if (!loggingOn() || !callId) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), callId, type, ...data });
    fs.appendFileSync(fileFor(callId), line + "\n");
    if (SYNC_ON.has(type)) syncToGithub(callId);
  } catch {
    /* logging must never break a call */
  }
}

export function listCalls(): { id: string; file: string; startedAt: string; bytes: number }[] {
  const dir = logDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse()
    .map((file) => ({
      id: file.replace(/\.jsonl$/, "").split("_").slice(1).join("_"),
      file,
      startedAt: file.split("_")[0] ?? "",
      bytes: fs.statSync(path.join(dir, file)).size,
    }));
}

export function readCall(callIdRaw: unknown): { file: string; events: Record<string, unknown>[] } | null {
  const id = safeId(callIdRaw);
  if (!id) return null;
  const hit = listCalls().find((c) => c.id === id);
  if (!hit) return null;
  const text = fs.readFileSync(path.join(logDir(), hit.file), "utf8");
  const events = text
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        return { type: "unreadable", line: l };
      }
    });
  return { file: hit.file, events };
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
