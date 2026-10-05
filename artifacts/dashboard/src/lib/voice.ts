/**
 * Voice adapter (browser). The call screen only uses this interface, so the browser's
 * built-in speech can later be replaced by ElevenLabs or Sarvam in this one file.
 */
export interface Listener {
  result: Promise<string | null>;
  abort(): void;
}

export interface VoiceAdapter {
  canSpeak: boolean;
  canListen: boolean;
  hasHindiVoice(): boolean;
  speak(text: string): Promise<void>;
  listen(timeoutMs: number, onIssue?: (msg: string) => void): Listener;
  cancel(): void;
}

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickHindiVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("hi"));
  if (voices.length === 0) return null;
  const preferred = voices.find((v) => /female|lekha|kalpana|swara|google/i.test(v.name));
  return preferred ?? voices[0] ?? null;
}

export function createBrowserVoice(): VoiceAdapter {
  const Ctor = recognitionCtor();
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  return {
    canSpeak,
    canListen: Ctor !== null,
    hasHindiVoice: () => canSpeak && pickHindiVoice() !== null,

    speak(text) {
      if (!canSpeak) return new Promise((r) => setTimeout(r, Math.min(6000, text.length * 60)));
      return new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "hi-IN";
        u.rate = 0.92;
        const v = pickHindiVoice();
        if (v) u.voice = v;
        const guard = setTimeout(resolve, text.length * 130 + 4000);
        const done = () => {
          clearTimeout(guard);
          resolve();
        };
        u.onend = done;
        u.onerror = done;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
    },

    listen(timeoutMs, onIssue) {
      if (!Ctor) return { result: new Promise<string | null>(() => undefined), abort: () => undefined };
      const rec = new Ctor();
      rec.lang = "hi-IN";
      rec.interimResults = false;
      rec.continuous = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = new Promise<string | null>((resolve) => {
        const finish = (v: string | null) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(v);
        };
        rec.onresult = (e) => finish(e.results[0]?.[0]?.transcript ?? null);
        let errored = false;
        rec.onerror = (e) => {
          if (e.error === "no-speech") return finish(null);
          if (e.error === "aborted") return;
          // A real problem (mic blocked, no network): stay open for typed replies instead of racing through silent turns.
          errored = true;
          onIssue?.(
            e.error === "not-allowed" || e.error === "service-not-allowed"
              ? "Microphone is blocked. Allow it for this site, or open the app in its own browser tab. You can type your reply instead."
              : `Speech recognition is not working (${e.error}). You can type your reply instead.`,
          );
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => finish(null), 45000);
        };
        rec.onend = () => {
          if (!errored) finish(null);
        };
        timer = setTimeout(() => {
          rec.abort();
          finish(null);
        }, timeoutMs);
        try {
          rec.start();
        } catch {
          finish(null);
        }
      });
      return {
        result,
        abort: () => {
          settled = true;
          if (timer) clearTimeout(timer);
          try {
            rec.abort();
          } catch {
            /* already stopped */
          }
        },
      };
    },

    cancel() {
      if (canSpeak) window.speechSynthesis.cancel();
    },
  };
}
