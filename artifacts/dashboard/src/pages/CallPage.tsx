import { useEffect, useState, type FormEvent } from "react";
import { getCallConfig, type CallConfig } from "../lib/api";
import { useCall } from "../lib/useCall";
import { Phone } from "../components/Phone";

export function CallPage() {
  const [config, setConfig] = useState<CallConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [draft, setDraft] = useState("");
  const call = useCall();

  useEffect(() => {
    getCallConfig()
      .then((c) => {
        setConfig(c);
        setCustomerId(c.customers[0]?.id ?? "");
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not reach the server"));
  }, []);

  const customer = config?.customers.find((c) => c.id === customerId);
  const live = call.phase !== "idle" && call.phase !== "ended";
  const canStart = Boolean(config?.llmConfigured && customer && !live);

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    call.submitTyped(draft.trim());
    setDraft("");
  };

  if (loadError) {
    return (
      <div className="card">
        <h2 className="h2">Can't reach the server</h2>
        <p className="muted">{loadError}</p>
      </div>
    );
  }
  if (!config) return <p className="muted">Loading…</p>;

  return (
    <div className="call-grid">
      <div className="call-left">
        <section className="card" aria-label="Start a call">
          <div className="row">
            <h2 className="h2" style={{ marginRight: "auto" }}>Start a call</h2>
            {config.testMode && <span className="chip c-hand">Test mode</span>}
          </div>

          <label htmlFor="cust" className="lbl">Borrower</label>
          <select id="cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={live}>
            {config.customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {customer && (
            <dl className="kv">
              <dt>EMI</dt><dd>₹{customer.emiAmount.toLocaleString("en-IN")}, due {customer.emiDueDate}</dd>
              <dt>Days late</dt><dd>{customer.daysPastDue}</dd>
              <dt>Call</dt><dd>Number {customer.callNumberThisWeek} this week</dd>
              <dt>Last time</dt><dd>{customer.lastCall}</dd>
              <dt>Earlier promise</dt><dd>{customer.brokenPromise}</dd>
            </dl>
          )}

          <div className="row">
            <button type="button" className="btn pri" onClick={() => customer && call.start(customer.id)} disabled={!canStart}>
              {call.phase === "ended" ? "Call again" : "Start call"}
            </button>
            {live && <button type="button" className="btn warn" onClick={call.end}>End call</button>}
          </div>

          {!config.llmConfigured && (
            <p className="note bad">
              The AI key is missing. Add <code>ANTHROPIC_API_KEY</code> under Replit Secrets, then restart the API server.
            </p>
          )}
          {config.testMode && !config.withinCallingHours && (
            <p className="note">
              It is {config.localTime} IST, outside the 8 AM to 7 PM calling hours. Test mode allows the call; real mode would block it.
            </p>
          )}
          {call.error && <p className="note bad">{call.error}</p>}
        </section>

        <section className="card" aria-label="Your reply">
          <h2 className="h2">Your reply</h2>
          <p className="muted small">
            Speak when the phone says “Listening”. If the microphone isn't available, type instead.
          </p>
          <form className="row" onSubmit={onSend}>
            <label htmlFor="reply" className="sr">Type the borrower's reply</label>
            <input
              id="reply"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a reply, e.g. Haan, bolo"
              disabled={call.phase !== "listening"}
              autoComplete="off"
            />
            <button type="submit" className="btn" disabled={call.phase !== "listening" || !draft.trim()}>Send</button>
          </form>
          {call.micIssue && <p className="note bad">{call.micIssue}</p>}
          <ul className="support small muted">
            <li>Agent voice: {call.voice.canSpeak ? (call.voice.hasHindiVoice() ? "Hindi voice found" : "No Hindi voice found; it will use a default voice") : "not supported in this browser"}</li>
            <li>Your microphone: {call.voice.canListen ? "supported (Chrome, allow the microphone)" : "not supported in this browser; use Chrome or type your replies"}</li>
          </ul>
        </section>
      </div>

      <Phone
        agentName={config.agentName}
        lenderName={config.lenderName}
        phase={call.phase}
        lines={call.lines}
        seconds={call.seconds}
        onEnd={call.end}
      />
    </div>
  );
}
