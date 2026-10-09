import { useCallback, useEffect, useRef, useState } from "react";
import { finishCall, logClientEvent, sendTurn, setCurrentCallId, startCall, type HistoryItem } from "./api";
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
  const callId = useRef<string | undefined>(undefined);
  const [loggedCallId, setLoggedCallId] = useState<string | undefined>(undefined);
  const log = useCallback((type: string, data: Record<string, unknown> = {}) => logClientEvent(callId.current, type, data), []);
  const history = useRef<HistoryItem[]>([]);
  const typed = useRef<((t: string) => void) | null>(null);
  const listener = useRef<Listener | null>(null);
  const nextId = useRef(1);
  const [micOn, setMicOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const micOnRef = useRef(false);
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
    if (active.current) {
      log("call_end");
      const id = callId.current;
      if (id) void finishCall(id).catch((e: unknown) => {
        setError(e instanceof Error ? `Call ended, but the review could not be saved: ${e.message}` : "Call ended, but the review could not be saved. Open the call details to retry.");
      });
    }
    active.current = false;
    generation.current += 1;
    typed.current?.("");
    muteSignal.current?.();
    unmuteSignal.current?.();
    voice.cancel();
    listener.current?.abort();
    setRecording(false);
    setPhase("ended");
  }, [voice, log]);

  const fail = useCallback(
    (e: unknown) => {
      setError(e instanceof Error ? e.message : "Something went wrong");
      log("error", { message: e instanceof Error ? e.message : String(e) });
      finish();
    },
    [finish, log],
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
      log("speak_start", { chars: speak.length });
      await voice.speak(speak);
      log("speak_end");
      if (!active.current || generation.current !== session) return;
      if (endCall) return finish();
      await steps.current?.listenTurn();
    },

    async listenTurn() {
      const session = generation.current;
      setPhase("listening");
      log("listen_start", { micOn: micOnRef.current });
      setRecording(false);
      const typedP = new Promise<string>((res) => {
        typed.current = res;
      });
      let text: string | null = null;
      let source: "typed" | "voice" = "voice";
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
            source = "typed";
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
        source = r.kind === "typed" ? "typed" : "voice";
        break;
      }
      typed.current = null;
      if (!active.current || generation.current !== session) return;
      const t = text && text.trim() ? text.trim() : null;
      if (t) {
        history.current.push({ role: "borrower", text: t });
        addLine("borrower", t);
        log("borrower_reply", { text: t, source });
      } else {
        log("silence_timeout", { micOn: micOnRef.current });
        history.current.push({ role: "borrower", text: "(silence)" });
        addLine("system", "(no reply)");
      }
      await steps.current?.requestTurn();
    },

    async requestTurn() {
      const session = generation.current;
      setPhase("thinking");
      try {
        const r = await sendTurn(customerId.current, history.current, callId.current);
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
      callId.current = undefined;
      setCurrentCallId(undefined);
      setLoggedCallId(undefined);
      history.current = [];
      nextId.current = 1;
      setLines([]);
      setError(null);
      setMicIssue(null);
      setSeconds(0);
      setRecording(false);
      micOnRef.current = false;
      setMicOn(false);
      active.current = true;
      setPhase("connecting");
      try {
        if (!active.current || generation.current !== session) return;
        const r = await startCall(id);
        callId.current = r.callId;
        setCurrentCallId(r.callId);
        setLoggedCallId(r.callId);
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
    log(next ? "mic_on" : "mic_off");
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
  }, [voice, log]);

  const finishVoiceReply = useCallback(() => listener.current?.finishNow(), []);

  const submitTyped = useCallback((text: string) => typed.current?.(text), []);

  useEffect(() => () => {
    active.current = false;
    generation.current += 1;
    voice.cancel();
    listener.current?.abort();
  }, [voice]);

  return { callId: loggedCallId, voice, phase, lines, error, micIssue, seconds, start, end, submitTyped, toggleMic, micOn, recording, finishVoiceReply };
}
