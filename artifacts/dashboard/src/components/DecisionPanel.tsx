import { useState } from "react";
import type { ActionKey, Band, Decision, WalkStep } from "../lib/api";
import { inr } from "../lib/format";

export const ACTION_LABEL: Record<ActionKey, string> = {
  ai_call: "AI call",
  digital: "Payment link",
  human: "Person's call",
  field: "Field visit",
  none: "No more effort",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym}`;
export const ord = (n: number) => {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

const bandTone = (b: Band) => (b === "High" ? "good" : b === "Medium" ? "warn" : "bad");
export const BandChip = ({ band, score }: { band: Band; score: number }) => (
  <span className={`chip ${bandTone(band)}`} title="Pay-confidence: how likely the plan is to end in payment">{band} confidence · {score}</span>
);

function Walk({ d }: { d: Decision }) {
  const hist = d.walk.filter((w) => w.source === "history");
  const call = d.walk.filter((w) => w.source === "call");
  const row = (w: WalkStep) => (
    <li key={w.id} className="walk-row">
      <span className={`src ${w.source}`}>{w.source === "history" ? "History" : "This call"}</span>
      <div className="walk-t">
        <b>{w.label}</b>
        <span>{w.detail}</span>
      </div>
      <span className={`delta ${w.delta > 0 ? "up" : w.delta < 0 ? "down" : "flat"}`}>{w.delta > 0 ? `+${w.delta}` : w.delta < 0 ? `${w.delta}` : "0"}</span>
      <span className="track" aria-hidden="true"><i style={{ width: `${w.running}%` }} /></span>
    </li>
  );
  return (
    <ol className="walk">
      <li className="walk-start">Start at 50, then history adjusts it</li>
      {hist.map(row)}
      <li className="walk-mid">
        <span>What history alone predicts</span>
        <BandChip band={d.prior.band} score={d.prior.score} />
      </li>
      {call.length > 0 ? call.map(row) : <li className="walk-none">The borrower did not speak, so there is no call evidence to add.</li>}
      <li className="walk-end">
        <span>Pay-confidence after this call</span>
        <BandChip band={d.result.band} score={d.result.score} />
      </li>
    </ol>
  );
}

function Ledger({ d }: { d: Decision }) {
  const h = d.history;
  const callOf = (m: string) => h.calls.find((c) => c.month === m);
  return (
    <details className="ledger">
      <summary>The history behind this {h.sample && <span className="tag">Sample data</span>}</summary>
      <p className="note">EMI is due on the {ord(h.profile.emiDueDay)}. Salary arrives about the {ord(h.profile.salaryDayFrom)} to {ord(h.profile.salaryDayTo)}.</p>
      <div className="tablewrap">
        <table className="grid slim">
          <thead>
            <tr><th>Month</th><th>EMI</th><th>Paid on</th><th>Calls made / answered</th><th>Promise</th></tr>
          </thead>
          <tbody>
            {h.ledger.map((l) => {
              const c = callOf(l.month);
              return (
                <tr key={l.month}>
                  <td>{monthName(l.month)}</td>
                  <td>{l.emi === "bounced" ? <span className="mark bad">Bounced</span> : <span className="mark ok">Paid on time</span>}</td>
                  <td>{l.paidOnDay ? `the ${ord(l.paidOnDay)}` : l.emi === "bounced" ? "Not yet" : "–"}</td>
                  <td>{c ? `${c.made} / ${c.answered}` : "–"}</td>
                  <td>{c?.promise ? <>the {ord(c.promise.day)} · <span className={c.promise.result === "kept" ? "mark ok" : "mark bad"}>{c.promise.result === "kept" ? "Kept" : "Broken"}</span></> : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {h.note && <p className="note small">{h.note}</p>}
    </details>
  );
}

export function DecisionPanel({
  d,
  status,
  onPlan,
}: {
  d: Decision;
  status?: { status: "approved" | "changed" | "dismissed"; action: string | null } | null;
  onPlan?: (status: "approved" | "changed" | "dismissed", action?: string) => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const [pick, setPick] = useState<ActionKey>("human");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const plan = d.plan;
  const act = async (s: "approved" | "changed" | "dismissed", a?: string) => {
    if (!onPlan) return;
    setBusy(true);
    setErr(null);
    try {
      await onPlan(s, a);
      setChanging(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <section className="panel dec" aria-label="Recommended next step">
        <header className="panel-h">
          <h2>Recommended next step</h2>
          <BandChip band={d.result.band} score={d.result.score} />
        </header>
        {d.blocked || !plan ? (
          <p className="note bad">{d.blocked ?? "No plan could be made."}</p>
        ) : (
          <>
            <p className="dec-head">{plan.headline}</p>
            <ol className="dsteps">
              {plan.steps.map((s) => (
                <li key={s.order} className={s.kind === "fallback" ? "fb" : ""}>
                  <span className="dnum">{s.order}</span>
                  <div className="dbody">
                    <div className="dtop">
                      <span className={`act a-${s.action}`}>{ACTION_LABEL[s.action]}</span>
                      <b>{s.title}</b>
                      {s.kind === "fallback" && <span className="tag">If needed</span>}
                    </div>
                    <div className="dwhen">{s.when}</div>
                    <div className="dwhy">{s.why}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="note dcost">
              {plan.estimatedCostRupees === null ? "Cost of effort: not estimated for a field visit." : plan.estimatedCostRupees === 0 ? "No call is needed in the main plan, so no call cost." : `Estimated cost of calls: about ${inr(plan.estimatedCostRupees)}`}
              {" · "}{inr(plan.amountAtStake)} at stake (EMI plus bounce charge). <span title={plan.costNote}>Cost basis ⓘ</span>
            </p>
            {plan.suggestion && (
              <div className="dsug"><b>Fix the cause, not just this EMI.</b> {plan.suggestion}</div>
            )}
            {onPlan ? (
              status ? (
                <div className={`dstatus ${status.status}`} role="status">
                  {status.status === "approved" && "Approved. In this test build nothing is sent to the borrower."}
                  {status.status === "changed" && `Changed to: ${ACTION_LABEL[(status.action as ActionKey) ?? "human"] ?? status.action}. Logged for review.`}
                  {status.status === "dismissed" && "Dismissed. No action will be taken."}
                </div>
              ) : changing ? (
                <div className="dactions">
                  <label className="sr" htmlFor="pickact">Choose a different action</label>
                  <select id="pickact" value={pick} onChange={(e) => setPick(e.target.value as ActionKey)}>
                    {(Object.keys(ACTION_LABEL) as ActionKey[]).map((k) => <option key={k} value={k}>{ACTION_LABEL[k]}</option>)}
                  </select>
                  <button className="btn" disabled={busy} onClick={() => void act("changed", pick)}>Confirm change</button>
                  <button className="btn ghost" disabled={busy} onClick={() => setChanging(false)}>Cancel</button>
                </div>
              ) : (
                <div className="dactions">
                  <button className="btn" disabled={busy} onClick={() => void act("approved")}>Approve</button>
                  <button className="btn ghost" disabled={busy} onClick={() => setChanging(true)}>Change</button>
                  <button className="btn ghost" disabled={busy} onClick={() => void act("dismissed")}>Dismiss</button>
                </div>
              )
            ) : (
              <p className="note small">Preview only. Approve, Change and Dismiss appear on a real call's review.</p>
            )}
            {err && <p className="note bad">{err}</p>}
          </>
        )}
      </section>

      <section className="panel" aria-label="Did history change the decision">
        <header className="panel-h">
          <h2>Did history change the decision?</h2>
          <span className={`chip ${d.changed ? "good" : "neutral"}`}>{d.changed ? "Yes, it changed" : "Confirmed the obvious step"}</span>
        </header>
        <div className="vs">
          <div className="vs-card">
            <div className="vs-k">The call alone</div>
            <div className="vs-t">{d.callAlone.text}</div>
            <div className="vs-s">How a CRM treats a call today: a promise becomes a callback.</div>
          </div>
          <div className="vs-arrow" aria-hidden="true">→</div>
          <div className="vs-card hi">
            <div className="vs-k">Call plus history</div>
            <div className="vs-t">{d.withHistory.text || "No plan"}</div>
            <div className="vs-s">{d.because}</div>
          </div>
        </div>
      </section>

      <section className="panel" aria-label="How the confidence was built">
        <header className="panel-h">
          <h2>How the confidence was built</h2>
        </header>
        <p className="note">History sets the starting expectation. What the borrower said on this call then raises or lowers it, one step at a time. Weights are illustrative until calibrated on real outcomes.</p>
        <Walk d={d} />
        <Ledger d={d} />
        <details className="ledger">
          <summary>What this does not use yet</summary>
          <ul className="notbuilt">{d.notBuilt.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      </section>
    </div>
  );
}
