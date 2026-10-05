import { complete, fastModel, type LlmMessage } from "../adapters/llm";
import type { Customer } from "../lib/content";
import { buildSystemPrompt } from "./prompt";

export type HistoryItem =
  | { role: "agent"; text: string; raw?: string }
  | { role: "borrower"; text: string }
  | { role: "system"; text: string };

export interface AgentReply {
  say: string;
  speak: string;
  action: "none" | "send_link" | "raise_ticket" | "handoff";
  amount: number | null;
  reason: string | null;
  endCall: boolean;
}

/** Builds an alternating user/assistant message list. System notes ride along with the next user turn. */
export function toMessages(history: HistoryItem[]): LlmMessage[] {
  const out: LlmMessage[] = [];
  const push = (role: "user" | "assistant", content: string) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += "\n" + content;
    else out.push({ role, content });
  };
  for (const h of history) {
    if (h.role === "agent") {
      push(
        "assistant",
        h.raw ??
          JSON.stringify({ say: h.text, speak: h.text, action: "none", amount: null, reason: null, endCall: false }),
      );
    } else if (h.role === "borrower") push("user", h.text);
    else push("user", `[system] ${h.text}`);
  }
  if (out[0]?.role !== "user") out.unshift({ role: "user", content: "[system] The call has connected." });
  return out;
}

export function parseReply(raw: string): AgentReply {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(raw.slice(start, end + 1)) as Partial<AgentReply>;
      if (typeof j.say === "string" && j.say.trim()) {
        return {
          say: j.say.trim(),
          speak: (typeof j.speak === "string" && j.speak.trim()) || j.say.trim(),
          action: j.action === "send_link" || j.action === "raise_ticket" || j.action === "handoff" ? j.action : "none",
          amount: typeof j.amount === "number" ? j.amount : null,
          reason: typeof j.reason === "string" && j.reason.trim() ? j.reason.trim() : null,
          endCall: j.endCall === true,
        };
      }
    } catch {
      /* fall through to plain-text fallback */
    }
  }
  // The model's JSON was cut off or malformed: salvage the "say" text, never show raw JSON.
  const m = raw.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)/);
  let say = "";
  if (m?.[1]) {
    try {
      say = (JSON.parse(`"${m[1]}"`) as string).trim();
    } catch {
      say = m[1].replace(/\\"/g, '"').trim();
    }
  }
  if (!say && !raw.trim().startsWith("{")) say = raw.trim();
  if (!say) say = "Maaf kijiye, mujhe theek se sunai nahi diya. Kya aap dobara bata sakte hain?";
  return { say, speak: say, action: "none", amount: null, reason: null, endCall: false };
}

export async function runTurn(customer: Customer, history: HistoryItem[]): Promise<{ reply: AgentReply; raw: string }> {
  const raw = await complete({
    system: buildSystemPrompt(customer),
    messages: toMessages(history),
    maxTokens: 8192,
  });
  return { reply: parseReply(raw), raw };
}

/** Rewrites a fixed Roman-Hinglish line for a Hindi voice, without changing a word. */
export async function toSpeechVersion(line: string): Promise<string> {
  try {
    const out = await complete({
      model: fastModel(),
      maxTokens: 8192,
      system:
        "You rewrite Hinglish phone-call lines for a Hindi text-to-speech voice. Keep the wording exactly the same. Write Hindi words in Devanagari. Keep English loanwords (EMI, link, UPI, app, payment) in Latin letters. Output only the rewritten line.",
      messages: [{ role: "user", content: line }],
    });
    return out.trim() || line;
  } catch {
    return line;
  }
}
