import { useEffect, useState } from "react";
import { getPerformance, type Performance } from "../lib/api";
import { Section, Tile } from "../components/Ui";
import { LineChart } from "../components/LineChart";
import { day, inr, mmss, OUTCOME_LABEL, pct, secs } from "../lib/format";

const ORDER = ["promise_to_pay", "part_payment", "link_sent", "no_commitment", "escalated", "refused", "wrong_person", "incomplete"];

function Bars({ rows, max, format }: { rows: { label: string; value: number; sub?: string }[]; max: number; format: (n: number) => string }) {
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bl">{r.label}</span>
          <span className="bt"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></span>
          <span className="bv">{format(r.value)}{r.sub && <span className="muted small"> {r.sub}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

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

  if (error) return <Section title="Performance"><p className="note bad">{error}</p></Section>;
  if (!p) return <p className="muted">Loading…</p>;
  const k = p.kpis;
  const outcomeRows = ORDER.filter((o) => p.outcomes[o]).map((o) => ({ label: OUTCOME_LABEL[o] ?? o, value: p.outcomes[o] ?? 0 }));
  const outMax = Math.max(1, ...outcomeRows.map((r) => r.value));
  const reviewed = p.totals.reviewed > 0;

  return (
    <div className="stack">
      <Section
        title="Collections performance"
        right={
          <label className="toggle">
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Include sample data
          </label>
        }
      >
        <p className="note">
          {p.totals.liveCalls} live call{p.totals.liveCalls === 1 ? "" : "s"}
          {p.includesSample && <> + <b>{p.totals.sampleCalls} sample calls</b> (synthetic, to show how this page looks at volume)</>}. Is the agent recovering money? For rule breaches and trust, see <a href="#/quality">Quality</a>.
        </p>
        {!reviewed ? (
          <p className="muted">No reviewed calls yet. Finish a call and it is added here.</p>
        ) : (
          <div className="tiles big">
            <Tile label="Promise-to-pay rate" value={pct(k.promiseToPayPct)} hint="Calls ending in a promise, part payment or link, of calls where identity was confirmed" />
            <Tile label="Amount promised" value={inr(k.promisedAmount)} />
            <Tile label="Avg reply time" value={secs(k.replyGapMs)} hint="Borrower stops → Meera speaks" />
            <Tile label="Avg call length" value={k.avgDurationSec === null ? "–" : mmss(k.avgDurationSec)} />
            <Tile label="Tickets per 100 calls" value={k.ticketsPer100 ?? "–"} />
            <Tile label="Calls reviewed" value={p.totals.reviewed} />
          </div>
        )}
      </Section>
      {reviewed && (
        <div className="two">
          <Section title="How calls ended">
            <Bars rows={outcomeRows} max={outMax} format={(n) => String(n)} />
          </Section>
          <Section title="Reply time, by day">
            <LineChart title="Average reply time" better="lower" yMin={0} format={(n) => secs(n)} points={p.trend.map((t) => ({ label: day(t.date), y: t.replyGapMs }))} />
          </Section>
        </div>
      )}
    </div>
  );
}
