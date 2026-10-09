/**
 * LLM adapter. The only place that knows how to talk to the model vendor.
 * Swap the vendor by changing this file; nothing else imports an SDK.
 */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  model?: string;
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. Add it under Replit Secrets.");
  }
}

export const defaultModel = () => process.env["LLM_MODEL"] ?? "claude-sonnet-5-5";
export const fastModel = () => process.env["LLM_FAST_MODEL"] ?? "claude-haiku-4-5-20251001";

export function llmConfigured(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

export async function complete(req: LlmRequest): Promise<string> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new LlmNotConfiguredError();

  const res = await fetch(`${process.env["ANTHROPIC_API_URL"] ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.model ?? defaultModel(),
      max_tokens: req.maxTokens ?? 400,
      // The long instructions are cached so later turns of a call are fast.
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}
