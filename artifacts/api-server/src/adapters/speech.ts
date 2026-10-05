/**
 * Speech adapter. The only place that knows about the speech vendor (Sarvam).
 * If SARVAM_API_KEY is not set, the browser's own voice is used instead and nothing here runs.
 */
const BASE = "https://api.sarvam.ai";

export class SpeechError extends Error {}

export const speechConfigured = () => Boolean(process.env["SARVAM_API_KEY"]);

function key(): string {
  const k = process.env["SARVAM_API_KEY"];
  if (!k) throw new SpeechError("SARVAM_API_KEY is not set. Add it under Replit Secrets.");
  return k;
}

/** Audio in (webm, wav, ogg ...), Hindi/Hinglish text out. */
export async function transcribe(audio: Buffer, mime: string): Promise<string> {
  const base = (mime.split(";")[0] ?? "audio/webm").trim() || "audio/webm";
  const ext = base.split("/")[1]?.replace("x-", "") ?? "webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: base }), `speech.${ext}`);
  form.append("language_code", process.env["SARVAM_STT_LANGUAGE"] ?? "hi-IN");
  const model = process.env["SARVAM_STT_MODEL"];
  if (model) form.append("model", model);
  const mode = process.env["SARVAM_STT_MODE"];
  if (mode) form.append("mode", mode);

  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key() },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { transcript?: string; error?: unknown; message?: string };
  if (!res.ok) throw new SpeechError(`Speech-to-text failed (${res.status}): ${JSON.stringify(body.error ?? body.message ?? body)}`);
  return (body.transcript ?? "").trim();
}

/** Text in (Devanagari plus Latin loanwords), base64 WAV out. */
export async function synthesize(text: string): Promise<string> {
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": key(), "content-type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 2400),
      target_language_code: "hi-IN",
      language_code: "hi-IN",
      speaker: process.env["SARVAM_SPEAKER"] ?? "priya",
      model: process.env["SARVAM_TTS_MODEL"] ?? "bulbul:v3",
      pace: Number(process.env["SARVAM_PACE"] ?? "0.95"),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { audios?: string[]; error?: unknown; message?: string };
  if (!res.ok) throw new SpeechError(`Text-to-speech failed (${res.status}): ${JSON.stringify(body.error ?? body.message ?? body)}`);
  const audio = body.audios?.[0];
  if (!audio) throw new SpeechError("Text-to-speech returned no audio");
  return audio;
}
