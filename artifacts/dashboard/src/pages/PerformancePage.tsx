import { useEffect, useState } from "react";
import { isDemoMode, getPerformance, type Performance } from "../lib/api";
import { Metric, Section } from "../components/Ui";
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

/** Collections business performance: six metrics, then why borrowers miss payments. */
export function PerformancePage() {
  const [sample, setSample] = useState(isDemoMode);
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
          {p.includesSample && <> + <b>{p.totals.sampleCalls} sample calls</b> (synthetic: {p.totals.sampleCalls} payments of ₹5,000 each, ₹{(p.totals.sampleCalls * 5000).toLocaleString("en-IN")} in total)</>}. Rules and trust are on <a href="#/quality">Agent performance</a>.
        </p>
        {!reviewed ? (
          <p className="muted">No reviewed calls yet. Finish a call and it is added here.</p>
        ) : (
          <>
            <h3 className="grp">Outcomes</h3>
            <div className="mgrid">
              <Metric
                label="Payment collected"
                what="Rupees recovered out of the rupees we set out to recover. A payment link that has been sent counts as paid."
                value={c.collected ? pct(c.collected.pct) : "–"}
                detail={c.collected ? `${inr(c.collected.paid)} of ${inr(c.collected.due)} across ${c.collected.cases} payments` : undefined}
              />
              <Metric
                label="Resolution rate"
                what="Share of bounced EMIs that were recovered in full."
                value={c.resolution ? pct(c.resolution.pct) : "–"}
                detail={c.resolution ? `${c.resolution.resolved} of ${c.resolution.cases} EMIs` : undefined}
              />
              <Metric
                label="Resolution time"
                what="Median number of days from the first call to the EMI being recovered in full."
                value={c.resolutionDays?.median != null ? `${c.resolutionDays.median} days` : "–"}
                detail={c.resolutionDays ? `Across ${c.resolutionDays.n} recovered EMIs` : undefined}
              />
            </div>
            <h3 className="grp">How the conversations go</h3>
            <div className="mgrid">
              <Metric
                label="Promise-to-pay rate"
                what="Share of conversations that ended with a clear date and amount to pay."
                value={pct(c.promise.pct)}
                detail={`${c.promise.clear} of ${c.promise.talked} conversations`}
              />
              <Metric
                label="Clear reason given"
                what="Share of conversations where the borrower gave a usable reason for the missed EMI."
                value={pct(c.reason.pct)}
                detail={`${c.reason.clear} of ${c.reason.talked} conversations`}
              />
              <Metric
                label="Human handoff rate"
                what="Share of conversations that needed a person, either handed over during the call or routed there by the next-step plan."
                value={pct(c.handoff.pct)}
                detail={`${c.handoff.count} of ${c.handoff.talked} conversations`}
              />
            </div>
          </>
        )}
      </Section>
      {reviewed && (
        <Section title="Why borrowers miss payments">
          <p className="note">The root cause the borrower gave, across conversations where they spoke.</p>
          {causeRows.length ? <Bars rows={causeRows} max={causeMax} /> : <p className="muted">No reasons captured yet.</p>}
        </Section>
      )}
    </div>
  );
}
