import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendTurn, startCall, type HistoryItem } from "./api";
import { createBrowserVoice, type Listener } from "./voice";

export type Phase = "idle" | "connecting" | "speaking" | "listening" | "thinking" | "ended";
export interface Line {
  id: number;
  who: "agent" | "borrower" | "system";
  text: string;
}

const LISTEN_TIMEOUT_MS = 9000;

export function useCall() {
  const voice = useMemo(() => createBrowserVoice(), []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micIssue, setMicIssue] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const active = useRef(false);
  const customerId = useRef("");
  const history = useRef<HistoryItem[]>([]);
  const typed = useRef<((t: string) => void) | null>(null);
  const listener = useRef<Listener | null>(null);
  const nextId = useRef(1);

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
    voice.cancel();
    listener.current?.abort();
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
      if (!active.current) return;
      if (endCall) return finish();
      await steps.current?.listenTurn();
    },

    async listenTurn() {
      setPhase("listening");
      const l = voice.listen(LISTEN_TIMEOUT_MS, setMicIssue);
      listener.current = l;
      const typedP = new Promise<string>((res) => {
        typed.current = res;
      });
      const text = await Promise.race([l.result, typedP]);
      l.abort();
      typed.current = null;
      if (!active.current) return;
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
      setPhase("thinking");
      try {
        const r = await sendTurn(customerId.current, history.current);
        if (!active.current) return;
        await steps.current?.agentTurn({
          say: r.say,
          speak: r.speak,
          raw: r.raw,
          endCall: r.endCall,
          note: r.systemNote,
          handoff: r.action === "handoff",
        });
      } catch (e) {
        fail(e);
      }
    },
  };

  const start = useCallback(
    async (id: string) => {
      voice.cancel();
      customerId.current = id;
      history.current = [];
      nextId.current = 1;
      setLines([]);
      setError(null);
      setMicIssue(null);
      setSeconds(0);
      active.current = true;
      setPhase("connecting");
      try {
        const r = await startCall(id);
        await new Promise((res) => setTimeout(res, 1200)); // ringing
        if (!active.current) return;
        await steps.current?.agentTurn({ say: r.say, speak: r.speak, endCall: false });
      } catch (e) {
        fail(e);
      }
    },
    [voice, fail],
  );

  const end = useCallback(() => {
    typed.current?.("");
    finish();
  }, [finish]);

  const submitTyped = useCallback((text: string) => typed.current?.(text), []);

  useEffect(() => () => {
    active.current = false;
    voice.cancel();
    listener.current?.abort();
  }, [voice]);

  return { voice, phase, lines, error, micIssue, seconds, start, end, submitTyped };
}
