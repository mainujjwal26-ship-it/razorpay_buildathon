import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Line, Phase } from "../lib/useCall";

const STATUS: Record<Phase, string> = {
  idle: "Ready",
  connecting: "Connecting",
  speaking: "Meera is speaking",
  listening: "Listening",
  thinking: "Thinking",
  ended: "Call ended",
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Highlight amounts and dates in Meera's caption.
const KEY = /(₹\s?[\d,]+|\b\d[\d,.]*\b|\b\S+ (?:rupaye|rupees|tareekh|tarikh)\b)/gi;
function highlight(text: string): ReactNode[] {
  return text.split(KEY).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export interface CallSummary {
  name: string;
  emiAmount: number;
  daysPastDue: number;
}

export function Phone(props: {
  agentName: string;
  lenderName: string;
  summary: CallSummary | null;
  phase: Phase;
  lines: Line[];
  seconds: number;
  micIssue: string | null;
  error: string | null;
  keyMissing: boolean;
  canStart: boolean;
  onStart: () => void;
  onEnd: () => void;
  onSubmit: (text: string) => void;
  onMic: () => void;
}) {
  const { agentName, lenderName, summary, phase, lines, seconds, micIssue, error, keyMissing, canStart, onStart, onEnd, onSubmit, onMic } = props;
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const live = phase !== "idle" && phase !== "ended";
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, phase]);
  const showTyped = typing || Boolean(micIssue);

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || phase !== "listening") return;
    onSubmit(draft.trim());
    setDraft("");
  };

  return (
    <div className="phone" role="group" aria-label="Call screen">
      <div className="screen">
        <div className="head">
          <div className="who">
            <b>{lenderName}</b>
            <span>{agentName}</span>
          </div>
          {live || phase === "ended" ? (
            <div className={`pill s-${phase}`} aria-live="polite">
              <span className="dot" aria-hidden="true" />
              {STATUS[phase]}
            </div>
          ) : null}
        </div>

        {phase === "idle" && (
          <div className="start">
            {summary ? (
              <p className="who-called">
                Calling <b>{summary.name}</b>
                <br />
                EMI ₹{summary.emiAmount.toLocaleString("en-IN")} · {summary.daysPastDue} days overdue
              </p>
            ) : (
              <p className="who-called">Loading…</p>
            )}
            <button type="button" className="callbtn" onClick={onStart} disabled={!canStart} aria-label="Start call">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
              </svg>
            </button>
            <span className="calllbl">Start call</span>
            {keyMissing && (
              <p className="note bad">
                The AI key is missing. Add <code>ANTHROPIC_API_KEY</code> under Replit Secrets, then restart the server.
              </p>
            )}
            {error && <p className="note bad">{error}</p>}
          </div>
        )}

        {phase !== "idle" && phase !== "ended" && (
          <>
            <div className={`wave ${phase === "speaking" ? "on" : ""}`} aria-hidden="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />
              ))}
            </div>
            <div className="body" ref={scroller}>
              {lines.length === 0 && <p className="muted center">Connecting…</p>}
              {lines.map((l) =>
                l.who === "system" ? (
                  <div key={l.id} className="card sys">{l.text}</div>
                ) : l.who === "agent" ? (
                  <div key={l.id} className="bub ag">{highlight(l.text)}</div>
                ) : (
                  <div key={l.id} className="bub bw">{l.text}</div>
                ),
              )}
              {phase === "thinking" && <div className="think">Meera is thinking…</div>}
              {micIssue && <p className="note bad">{micIssue}</p>}
            </div>
            {showTyped && (
              <form className="typed" onSubmit={send}>
                <label htmlFor="reply" className="sr">Type your reply</label>
                <input
                  id="reply"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a reply, e.g. Haan, bolo"
                  disabled={phase !== "listening"}
                  autoComplete="off"
                />
                <button type="submit" disabled={phase !== "listening" || !draft.trim()}>Send</button>
              </form>
            )}
            <div className="bar">
              <span className="timer">{mmss(seconds)}</span>
              <button
                type="button"
                className={`mic ${phase === "listening" ? "on" : "off"}`}
                onClick={onMic}
                disabled={phase !== "listening"}
                aria-label={phase === "listening" ? "Mic is on. Tap when you have finished speaking" : "Mic is off"}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>
              <div className="bar-right">
                <button type="button" className="kb" onClick={() => setTyping((t) => !t)} aria-label="Type a reply instead" aria-pressed={showTyped}>
                  ⌨
                </button>
                <button type="button" className="hangup" onClick={onEnd} aria-label="End call">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 9c-3.3 0-6.4 1-8.7 2.8a1.2 1.2 0 0 0-.1 1.8l1.6 1.6c.4.4 1 .5 1.5.2l2.3-1.2c.4-.2.6-.6.6-1V11.7c1.2-.4 2.5-.6 3.8-.6s2.6.2 3.8.6v1.5c0 .4.2.8.6 1l2.3 1.2c.5.3 1.1.2 1.5-.2l1.6-1.6a1.2 1.2 0 0 0-.1-1.8C18.4 10 15.3 9 12 9z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {phase === "ended" && (
          <div className="start">
            <p className="who-called">
              <b>Call ended</b>
              <br />
              {mmss(seconds)}
            </p>
            {error && <p className="note bad">{error}</p>}
            <button type="button" className="btn pri" onClick={onStart} disabled={!canStart}>
              Start another call
            </button>
          </div>
        )}

        <div className="testline">Test build · the payment link is a dummy and nothing is saved</div>
      </div>
    </div>
  );
}
