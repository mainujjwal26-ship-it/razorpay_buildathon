import { useEffect, useState } from "react";
import { getPerformance, type Performance } from "../lib/api";
import { Section, Tile } from "../components/Ui";
import { inr, pct, ROOT_CAUSE_LABEL } from "../lib/format";

function Bars({ rows, max }: { rows: { label: string; value: number }[]; max: number }) {
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bl">{r.label}</span>
          <span className="bt"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></span>
          <span className="bv">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

const NOT_CONNECTED = "Needs payment confirmation, which is not connected in this build. Shown from sample data.";

/** Collections business performance: six metrics, then why borrowers miss payments. */
export function PerformancePage() {
  const [sample, setSample] = useState(false);
  const [auto, setAuto] = useState(true);
  const [p, setP] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    getPerformance(sample)
      .then((x) => {
        if (auto && !sample && x.totals.reviewed === 0) setSample(true); // nothing real yet: show the sample so the page is not empty
        setAuto(false);
        setP(x);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
  }, [sample]);

  if (error) return <Section title="Collections performance"><p className="note bad">{error}</p></Section>;
  if (!p) return <p className="muted">Loading…</p>;
  const c = p.collections;
  const reviewed = p.totals.reviewed > 0;
  const causeRows = Object.entries(p.rootCauses ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: ROOT_CAUSE_LABEL[k] ?? k, value: v }));
  const causeMax = Math.max(1, ...causeRows.map((r) => r.value));
  const noPay = !c.collected;

  return (
    <div className="stack">
      <Section
        title="Is the agent recovering money?"
        right={
          <label className="toggle">
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Include sample data
          </label>
        }
      >
        <p className="note">
          {p.totals.liveCalls} live call{p.totals.liveCalls === 1 ? "" : "s"}
          {p.includesSample && <> + <b>{p.totals.sampleCalls} sample calls</b> (synthetic, with simulated payments)</>}. Rules and trust are on <a href="#/quality">Agent performance</a>.
        </p>
        {!reviewed ? (
          <p className="muted">No reviewed calls yet. Finish a call and it is added here.</p>
        ) : (
          <>
            <h3 className="grp">Outcomes</h3>
            <div className="tiles big">
              <Tile
                label="Payment collected"
                value={c.collected ? pct(c.collected.pct) : "–"}
                hint={c.collected ? `${inr(c.collected.paid)} of ${inr(c.collected.due)} due (EMI plus bounce charge)` : NOT_CONNECTED}
              />
              <Tile
                label="Resolution rate"
                value={c.resolution ? pct(c.resolution.pct) : "–"}
                hint={c.resolution ? `${c.resolution.resolved} of ${c.resolution.cases} bounced EMIs paid in full` : NOT_CONNECTED}
              />
              <Tile
                label="Resolution time"
                value={c.resolutionDays?.median != null ? `${c.resolutionDays.median} days` : "–"}
                hint={c.resolutionDays ? `Median, first call to full payment, over ${c.resolutionDays.n} resolved cases` : NOT_CONNECTED}
              />
            </div>
            <h3 className="grp">How the conversations go</h3>
            <div className="tiles big">
              <Tile label="Promise-to-pay rate" value={pct(c.promise.pct)} hint={`${c.promise.clear} of ${c.promise.talked} conversations ended with a clear date and amount`} />
              <Tile label="Clear reason given" value={pct(c.reason.pct)} hint={`${c.reason.clear} of ${c.reason.talked} conversations gave a usable reason`} />
              <Tile
                label="Human handoff rate"
                value={pct(c.handoff.pct)}
                hint={`${c.handoff.count} of ${c.handoff.talked}: ${c.handoff.inCall} handed off or ticketed in the call, ${c.handoff.routed} routed to a person by the plan. Context, not a target: hardship cases should reach a person.`}
              />
            </div>
            {noPay && <p className="note">Payment-based metrics show “–” until payment status is connected. Turn on sample data to see how they look at volume.</p>}
          </>
        )}
      </Section>
      {reviewed && (
        <Section title="Why borrowers miss payments">
          <p className="note">Supporting view: the root cause the borrower gave, across conversations where they spoke.</p>
          {causeRows.length ? <Bars rows={causeRows} max={causeMax} /> : <p className="muted">No reasons captured yet.</p>}
        </Section>
      )}
    </div>
  );
}
