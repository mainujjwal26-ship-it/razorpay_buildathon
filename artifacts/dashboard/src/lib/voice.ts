/**
 * Voice adapter (browser). The call screen only uses this interface, so the browser's
 * built-in speech can later be replaced by ElevenLabs or Sarvam in this one file.
 */
import { speakText } from "./api";
import { listenToMicrophone, resumeMicrophoneContext } from "./microphone";

export interface Listener {
  result: Promise<string | null>;
  abort(): void;
  /** Stop recording now and use what was said so far. */
  finishNow(): void;
}

export interface VoiceAdapter {
  canSpeak: boolean;
  canListen: boolean;
  hasHindiVoice(): boolean;
  prepare?(): Promise<void>;
  speak(text: string): Promise<void>;
  listen(timeoutMs: number, onIssue?: (msg: string) => void, onRecording?: (recording: boolean) => void): Listener;
  cancel(): void;
}

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
const END_OF_SPEECH_MS = 2200; // how long a pause counts as "finished speaking"
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
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
        u.rate = 1.05;
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

    listen(timeoutMs, onIssue, onRecording) {
      if (!Ctor) {
        onIssue?.("Voice input is not supported by this browser. You can type your reply instead.");
        return { result: new Promise<string | null>(() => undefined), abort: () => undefined, finishNow: () => undefined };
      }
      const rec = new Ctor();
      rec.lang = "hi-IN";
      rec.interimResults = true;
      rec.continuous = true; // keep listening through short pauses; we decide when the borrower is done
      let settled = false;
      let heard = "";
      let noSpeechTimer: ReturnType<typeof setTimeout> | undefined;
      let endTimer: ReturnType<typeof setTimeout> | undefined;
      const clearAll = () => {
        if (noSpeechTimer) clearTimeout(noSpeechTimer);
        if (endTimer) clearTimeout(endTimer);
      };
      const result = new Promise<string | null>((resolve) => {
        const finish = (v: string | null) => {
          if (settled) return;
          settled = true;
          clearAll();
          onRecording?.(false);
          try {
            rec.abort();
          } catch {
            /* already stopped */
          }
          resolve(v);
        };
        rec.onresult = (e) => {
          let text = "";
          for (let i = 0; i < e.results.length; i++) text += (e.results[i]?.[0]?.transcript ?? "") + " ";
          heard = text.trim();
          if (noSpeechTimer) clearTimeout(noSpeechTimer);
          if (endTimer) clearTimeout(endTimer);
          endTimer = setTimeout(() => finish(heard || null), END_OF_SPEECH_MS);
        };
        rec.onstart = () => { if (!settled) onRecording?.(true); };
        let errored = false;
        rec.onerror = (e) => {
          if (e.error === "no-speech") return; // keep waiting until our own timeout
          if (e.error === "aborted") return;
          errored = true;
          onRecording?.(false);
          onIssue?.(
            e.error === "not-allowed" || e.error === "service-not-allowed"
              ? "Microphone is blocked. Allow it for this site, or open the app in its own browser tab. You can type your reply instead."
              : `Speech recognition is not working (${e.error}). You can type your reply instead.`,
          );
          clearAll();
        };
        rec.onend = () => {
          onRecording?.(false);
          if (errored || settled) return;
          // The browser stopped by itself (it does after a long quiet spell). Use what we have or restart.
          if (heard) return finish(heard);
          try {
            rec.start();
          } catch {
            finish(null);
          }
        };
        noSpeechTimer = setTimeout(() => finish(null), timeoutMs);
        try {
          rec.start();
        } catch (error) {
          clearAll();
          onIssue?.(`Voice input could not start: ${error instanceof Error ? error.message : "unknown error"}. You can type your reply instead.`);
        }
      });
      return {
        result,
        abort: () => {
          settled = true;
          clearAll();
          onRecording?.(false);
          try {
            rec.abort();
          } catch {
            /* already stopped */
          }
        },
        finishNow: () => {
          try {
            rec.stop();
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
  let context: AudioContext | null = null;
  const getContext = () => {
    if (!context || context.state === "closed") {
      const Constructor = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) throw new Error("This browser does not support microphone audio analysis");
      context = new Constructor();
    }
    return context;
  };

  return {
    canSpeak: true,
    canListen,
    hasHindiVoice: () => true,
    // Called directly from the user's start/unmute click to unlock browser audio.
    prepare: () => resumeMicrophoneContext(getContext()),

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

    listen(timeoutMs, onIssue, onRecording) {
      return listenToMicrophone(timeoutMs, getContext, onIssue, onRecording);
    },

    cancel() {
      audio?.pause();
      audio = null;
      if (context) {
        void context.close().catch(() => undefined);
        context = null;
      }
      fallback.cancel();
    },
  };
}
