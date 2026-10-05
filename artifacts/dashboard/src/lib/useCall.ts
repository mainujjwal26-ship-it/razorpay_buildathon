import { useCallback, useEffect, useRef, useState } from "react";
import { sendTurn, startCall, type HistoryItem } from "./api";
import type { Listener, VoiceAdapter } from "./voice";

export type Phase = "idle" | "connecting" | "speaking" | "listening" | "thinking" | "ended";
export interface Line {
  id: number;
  who: "agent" | "borrower" | "system";
  text: string;
}

const LISTEN_TIMEOUT_MS = 15000; // how long to wait for the borrower to start speaking

export function useCall(voice: VoiceAdapter) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micIssue, setMicIssue] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const active = useRef(false);
  const generation = useRef(0);
  const customerId = useRef("");
  const history = useRef<HistoryItem[]>([]);
  const typed = useRef<((t: string) => void) | null>(null);
  const listener = useRef<Listener | null>(null);
  const nextId = useRef(1);
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const micOnRef = useRef(true);
  const muteSignal = useRef<(() => void) | null>(null);
  const unmuteSignal = useRef<(() => void) | null>(null);

  const running = phase !== "idle" && phase !== "ended";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const addLine = useCallback((who: Line["who"], text: string) => {
    setLines((l) => [...l, { id: nextId.current++, who, text }]);
  }, []);

  const finish = useCallback(() => {
    active.current = false;
    generation.current += 1;
    typed.current?.("");
    muteSignal.current?.();
    unmuteSignal.current?.();
    voice.cancel();
    listener.current?.abort();
    setRecording(false);
    setPhase("ended");
  }, [voice]);

  const fail = useCallback(
    (e: unknown) => {
      setError(e instanceof Error ? e.message : "Something went wrong");
      finish();
    },
    [finish],
  );

  // The three steps below call each other, so they live in one ref-held object.
  const steps = useRef<{
    agentTurn: (a: { say: string; speak: string; raw?: string; endCall: boolean; note?: string | null; handoff?: boolean }) => Promise<void>;
    listenTurn: () => Promise<void>;
    requestTurn: () => Promise<void>;
  } | null>(null);

  steps.current = {
    async agentTurn({ say, speak, raw, endCall, note, handoff }) {
      const session = generation.current;
      history.current.push({ role: "agent", text: say, ...(raw ? { raw } : {}) });
      addLine("agent", say);
      if (note) {
        history.current.push({ role: "system", text: note });
        addLine("system", note);
      }
      if (handoff) {
        history.current.push({ role: "system", text: "Handoff logged. A person will follow up." });
        addLine("system", "Handed to a person (not live in this build)");
      }
      setPhase("speaking");
      await voice.speak(speak);
      if (!active.current || generation.current !== session) return;
      if (endCall) return finish();
      await steps.current?.listenTurn();
    },

    async listenTurn() {
      const session = generation.current;
      setPhase("listening");
      setRecording(false);
      const typedP = new Promise<string>((res) => {
        typed.current = res;
      });
      let text: string | null = null;
      while (active.current && generation.current === session) {
        if (!micOnRef.current) {
          // Muted: wait until the mic is switched back on, or a typed reply arrives.
          const r = await Promise.race([
            typedP.then((t) => ({ t })),
            new Promise<{ t: null }>((res) => {
              unmuteSignal.current = () => res({ t: null });
            }),
          ]);
          unmuteSignal.current = null;
          if (r.t !== null) {
            text = r.t;
            break;
          }
          continue;
        }
        setMicIssue(null);
        const l = voice.listen(
          LISTEN_TIMEOUT_MS,
          (issue) => { if (active.current && generation.current === session) setMicIssue(issue); },
          (value) => { if (active.current && generation.current === session) setRecording(value); },
        );
        listener.current = l;
        const r = await Promise.race([
          l.result.then((v) => ({ kind: "heard" as const, v })),
          typedP.then((v) => ({ kind: "typed" as const, v })),
          new Promise<{ kind: "muted" }>((res) => {
            muteSignal.current = () => res({ kind: "muted" });
          }),
        ]);
        l.abort();
        listener.current = null;
        muteSignal.current = null;
        if (r.kind === "muted") continue;
        text = r.v;
        break;
      }
      typed.current = null;
      if (!active.current || generation.current !== session) return;
      const t = text && text.trim() ? text.trim() : null;
      if (t) {
        history.current.push({ role: "borrower", text: t });
        addLine("borrower", t);
      } else {
        history.current.push({ role: "borrower", text: "(silence)" });
        addLine("system", "(no reply)");
      }
      await steps.current?.requestTurn();
    },

    async requestTurn() {
      const session = generation.current;
      setPhase("thinking");
      try {
        const r = await sendTurn(customerId.current, history.current);
        if (!active.current || generation.current !== session) return;
        await steps.current?.agentTurn({
          say: r.say,
          speak: r.speak,
          raw: r.raw,
          endCall: r.endCall,
          note: r.systemNote,
          handoff: r.action === "handoff",
        });
      } catch (e) {
        if (active.current && generation.current === session) fail(e);
      }
    },
  };

  const start = useCallback(
    async (id: string) => {
      voice.cancel();
      const session = ++generation.current;
      customerId.current = id;
      history.current = [];
      nextId.current = 1;
      setLines([]);
      setError(null);
      setMicIssue(null);
      setSeconds(0);
      setRecording(false);
      micOnRef.current = true;
      setMicOn(true);
      active.current = true;
      setPhase("connecting");
      try {
        try {
          await voice.prepare?.();
        } catch (error) {
          if (active.current && generation.current === session) setMicIssue(error instanceof Error ? error.message : "Audio input could not start. You can type your reply instead.");
        }
        if (!active.current || generation.current !== session) return;
        const r = await startCall(id);
        await new Promise((res) => setTimeout(res, 1200)); // ringing
        if (!active.current || generation.current !== session) return;
        await steps.current?.agentTurn({ say: r.say, speak: r.speak, endCall: false });
      } catch (e) {
        if (active.current && generation.current === session) fail(e);
      }
    },
    [voice, fail],
  );

  const end = useCallback(() => {
    typed.current?.("");
    finish();
  }, [finish]);

  const toggleMic = useCallback(() => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    if (next) {
      setMicIssue(null);
      void voice.prepare?.().catch((error: unknown) => {
        if (active.current) setMicIssue(error instanceof Error ? error.message : "Audio input could not start.");
      });
      unmuteSignal.current?.();
    }
    else muteSignal.current?.();
  }, [voice]);

  const finishVoiceReply = useCallback(() => listener.current?.finishNow(), []);

  const submitTyped = useCallback((text: string) => typed.current?.(text), []);

  useEffect(() => () => {
    active.current = false;
    generation.current += 1;
    voice.cancel();
    listener.current?.abort();
  }, [voice]);

  return { voice, phase, lines, error, micIssue, seconds, start, end, submitTyped, toggleMic, micOn, recording, finishVoiceReply };
}
