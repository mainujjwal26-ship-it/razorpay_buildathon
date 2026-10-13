import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_CALL_ID, DEMO_LINES } from "./demo";
import type { VoiceAdapter } from "./voice";
import type { Line, Phase } from "./useCall";

/**
 * The same call, scripted. Returns what `useCall` returns, so the phone, the
 * transcript and the rest of the screen are the live components, unchanged.
 * Meera's lines are spoken through the same voice adapter when it works, so the
 * demo call is audible; if speech is unavailable each line is simply timed.
 */
const READ_MS = (text: string) => Math.min(4500, 1000 + text.length * 24);
const PAUSE_MS = 300;
/** Demo pace: Meera's recorded lines play slightly faster, and nothing waits once the audio ends. */
const RATE = 1.15;

export function useDemoCall(voice: VoiceAdapter) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [step, setStep] = useState(-1);
  const generation = useRef(0);
  const active = useRef(false);

  const running = phase !== "idle" && phase !== "ended";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const wait = (ms: number, session: number) =>
    new Promise<void>((res) => {
      const t = setTimeout(() => res(), ms);
      const check = setInterval(() => {
        if (generation.current !== session) {
          clearTimeout(t);
          clearInterval(check);
          res();
        }
      }, 120);
      setTimeout(() => clearInterval(check), ms + 60);
    });

  const play = useCallback(
    async (session: number) => {
      for (let i = 0; i < DEMO_LINES.length; i++) {
        if (generation.current !== session) return;
        const l = DEMO_LINES[i]!;
        setStep(i);
        if (l.who === "meera") {
          setPhase("speaking");
          setLines((x) => [...x, { id: i + 1, who: "agent", text: l.text }]);
          const spoken = voice.speak(l.text, RATE).then(() => true).catch(() => false);
          // With audio, the line ends when the audio ends; without it, leave time to read the line.
          await Promise.all([spoken, wait(voice.canSpeak ? 300 : READ_MS(l.text), session)]);
        } else {
          setPhase("listening");
          await wait(PAUSE_MS, session);
          if (generation.current !== session) return;
          setLines((x) => [...x, { id: i + 1, who: "borrower", text: l.text }]);
          await wait(Math.min(1400, READ_MS(l.text) * 0.4), session);
        }
      }
      if (generation.current !== session) return;
      setLines((x) => [...x, { id: 99, who: "system", text: "Payment link sent · ticket raised for the bounce-charge question" }]);
      active.current = false;
      setPhase("ended");
    },
    [voice],
  );

  const start = useCallback(() => {
    voice.cancel();
    const session = ++generation.current;
    active.current = true;
    setLines([]);
    setSeconds(0);
    setStep(-1);
    setPhase("connecting");
    void voice.prepare?.().catch(() => undefined);
    void (async () => {
      await wait(1200, session);
      if (generation.current !== session) return;
      await play(session);
    })();
  }, [voice, play]);

  const end = useCallback(() => {
    generation.current += 1;
    active.current = false;
    voice.cancel();
    setPhase("ended");
  }, [voice]);

  useEffect(
    () => () => {
      generation.current += 1;
      voice.cancel();
    },
    [voice],
  );

  const noop = useCallback(() => undefined, []);

  return {
    callId: phase === "ended" ? DEMO_CALL_ID : undefined,
    voice,
    phase,
    lines,
    error: null as string | null,
    micIssue: null as string | null,
    seconds,
    start,
    end,
    submitTyped: noop,
    toggleMic: noop,
    micOn: true,
    recording: false,
    finishVoiceReply: noop,
    soundBlocked: false,
    enableSound: noop,
    /** Index of the line now playing, for the note beside the call. */
    step,
  };
}
