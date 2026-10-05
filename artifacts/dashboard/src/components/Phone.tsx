import { useEffect, useRef } from "react";
import type { Line, Phase } from "../lib/useCall";

const STATUS: Record<Phase, string> = {
  idle: "Ready",
  connecting: "Calling…",
  speaking: "Speaking",
  listening: "Listening to you…",
  thinking: "Thinking…",
  ended: "Call ended",
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function Phone(props: {
  agentName: string;
  lenderName: string;
  phase: Phase;
  lines: Line[];
  seconds: number;
  onEnd: () => void;
}) {
  const { agentName, lenderName, phase, lines, seconds, onEnd } = props;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, phase]);

  const live = phase !== "idle" && phase !== "ended";

  return (
    <div className="phone" role="group" aria-label="Phone screen">
      <div className="phone-screen">
        <div className="phone-status">
          <span>9:41</span>
          <span className="phone-notch" aria-hidden="true" />
          <span>5G ▮▮▮</span>
        </div>
        <div className="phone-head">
          <div className="avatar" aria-hidden="true">{agentName.slice(0, 1)}</div>
          <div className="phone-who">
            <b>{agentName}</b>
            <span>{lenderName}</span>
          </div>
          <div className="phone-time">{live || phase === "ended" ? mmss(seconds) : ""}</div>
        </div>
        <div className={`phone-state s-${phase}`} aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {STATUS[phase]}
        </div>
        <div className="phone-chat" ref={scroller}>
          {lines.length === 0 && (
            <p className="phone-empty">
              {phase === "idle" ? "Press “Start call” and the agent will speak first." : "Connecting…"}
            </p>
          )}
          {lines.map((l) =>
            l.who === "system" ? (
              <div key={l.id} className="bubble sys">{l.text}</div>
            ) : (
              <div key={l.id} className={`bubble ${l.who === "agent" ? "ag" : "bw"}`}>
                <span className="who">{l.who === "agent" ? agentName.toUpperCase() : "YOU"}</span>
                {l.text}
              </div>
            ),
          )}
          {phase === "thinking" && <div className="bubble ag typing" aria-label="Agent is thinking">• • •</div>}
        </div>
        <div className="phone-foot">
          <div className={`mic ${phase === "listening" ? "on" : ""}`} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
          <button type="button" className="hangup" onClick={onEnd} disabled={!live} aria-label="End call">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 9c-3.3 0-6.4 1-8.7 2.8a1.2 1.2 0 0 0-.1 1.8l1.6 1.6c.4.4 1 .5 1.5.2l2.3-1.2c.4-.2.6-.6.6-1V11.7c1.2-.4 2.5-.6 3.8-.6s2.6.2 3.8.6v1.5c0 .4.2.8.6 1l2.3 1.2c.5.3 1.1.2 1.5-.2l1.6-1.6a1.2 1.2 0 0 0-.1-1.8C18.4 10 15.3 9 12 9z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
