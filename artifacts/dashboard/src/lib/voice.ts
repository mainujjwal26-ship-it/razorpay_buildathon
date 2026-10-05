/**
 * Voice adapter (browser). The call screen only uses this interface, so the browser's
 * built-in speech can later be replaced by ElevenLabs or Sarvam in this one file.
 */
import { speakText, transcribeAudio } from "./api";

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

/**
 * Sarvam voice: the browser records the borrower, the server turns audio into text, and Meera's
 * lines come back as audio. Falls back to the browser voice for a line if the server call fails.
 */
export function createSarvamVoice(): VoiceAdapter {
  const fallback = createBrowserVoice();
  const canListen =
    typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  let audio: HTMLAudioElement | null = null;

  return {
    canSpeak: true,
    canListen,
    hasHindiVoice: () => true,

    async speak(text) {
      try {
        const { audio: b64 } = await speakText(text);
        const el = new Audio(`data:audio/wav;base64,${b64}`);
        audio = el;
        await new Promise<void>((resolve, reject) => {
          el.onended = () => resolve();
          el.onerror = () => reject(new Error("audio"));
          el.play().catch(reject);
        });
      } catch {
        await fallback.speak(text);
      } finally {
        audio = null;
      }
    },

    listen(timeoutMs, onIssue) {
      if (!canListen) return { result: new Promise<string | null>(() => undefined), abort: () => undefined };
      let stopped = false;
      let cleanup: () => void = () => undefined;
      const result = new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (v: string | null) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        const issue = (msg: string) => {
          onIssue?.(msg);
          setTimeout(() => finish(null), 45000);
        };
        (async () => {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
          } catch {
            return issue("Microphone is blocked. Allow it for this site, or open the app in its own browser tab. You can type your reply instead.");
          }
          if (stopped) return stream.getTracks().forEach((t) => t.stop());

          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const buf = new Uint8Array(analyser.fftSize);
          const chunks: Blob[] = [];
          const rec = new MediaRecorder(stream);
          rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

          const t0 = Date.now();
          let speechAt = 0;
          let lastLoud = 0;
          let floor = 0;
          let samples = 0;
          let tick: ReturnType<typeof setInterval> | undefined;
          let ended = false;

          const release = () => {
            if (tick) clearInterval(tick);
            stream.getTracks().forEach((t) => t.stop());
            void ctx.close().catch(() => undefined);
          };
          cleanup = () => {
            ended = true;
            release();
            if (rec.state !== "inactive") rec.stop();
          };

          rec.onstop = async () => {
            release();
            if (stopped || ended) return;
            if (!speechAt) return finish(null);
            try {
              const text = await transcribeAudio(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
              finish(text || null);
            } catch (e) {
              issue(`Speech recognition is not working (${e instanceof Error ? e.message : "error"}). You can type your reply instead.`);
            }
          };

          rec.start();
          tick = setInterval(() => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) sum += ((v - 128) / 128) ** 2;
            const rms = Math.sqrt(sum / buf.length);
            const now = Date.now();
            if (now - t0 < 400) {
              floor = (floor * samples + rms) / (samples + 1);
              samples += 1;
              return;
            }
            const loud = rms > Math.max(0.02, floor * 3);
            if (loud) {
              if (!speechAt) speechAt = now;
              lastLoud = now;
            }
            const silentFor = now - lastLoud;
            const done =
              (speechAt && silentFor > 1300) || (speechAt && now - speechAt > 20000) || (!speechAt && now - t0 > timeoutMs);
            if (done && rec.state !== "inactive") {
              clearInterval(tick);
              rec.stop();
            }
          }, 50);
        })();
      });
      return {
        result,
        abort: () => {
          stopped = true;
          cleanup();
        },
      };
    },

    cancel() {
      audio?.pause();
      audio = null;
      fallback.cancel();
    },
  };
}
