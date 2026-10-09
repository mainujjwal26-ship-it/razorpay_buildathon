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
  const [sample, setSample] = useState(true);
  const [p, setP] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    getPerformance(sample).then(setP).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
  }, [sample]);

  if (error) return <Section title="Performance"><p className="note bad">{error}</p></Section>;
  if (!p) return <p className="muted">Loading…</p>;
  const k = p.kpis;
  const labelOf = (id: string) => p.checks.find((c) => c.id === id)?.label ?? id;
  const outcomeRows = ORDER.filter((o) => p.outcomes[o]).map((o) => ({ label: OUTCOME_LABEL[o] ?? o, value: p.outcomes[o] ?? 0 }));
  const outMax = Math.max(1, ...outcomeRows.map((r) => r.value));

  return (
    <div className="stack">
      <Section
        title="Team performance"
        right={
          <label className="toggle">
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Include sample data
          </label>
        }
      >
        <p className="note">
          {p.totals.liveCalls} live call{p.totals.liveCalls === 1 ? "" : "s"}
          {p.includesSample && <> + <b>{p.totals.sampleCalls} sample calls</b> (synthetic, to show how this page looks at volume)</>}. Rule checks are made by an AI reviewer on each call.
        </p>
        {p.totals.reviewed === 0 ? (
          <p className="muted">No reviewed calls yet. Finish a call and it is added here.</p>
        ) : (
          <div className="tiles big">
            <Tile label="Promise-to-pay rate" value={pct(k.promiseToPayPct)} hint="of calls where identity was confirmed" />
            <Tile label="Rule checks passed" value={pct(k.guardrailPassPct)} hint="all checks, all calls" />
            <Tile label="Calls with a hard-rule fail" value={pct(k.callsWithHardFailPct)} hint="lower is better" />
            <Tile label="Avg reply time" value={secs(k.replyGapMs)} hint="borrower stops → Meera speaks" />
            <Tile label="Identity confirmed" value={pct(k.identityConfirmedPct)} />
            <Tile label="Avg call length" value={k.avgDurationSec === null ? "–" : mmss(k.avgDurationSec)} />
            <Tile label="Tickets per 100 calls" value={k.ticketsPer100 ?? "–"} />
            <Tile label="Amount promised" value={inr(k.promisedAmount)} />
          </div>
        )}
      </Section>

      {p.totals.reviewed > 0 && (
        <>
          <div className="two">
            <Section title="Rule checks passed, by day">
              <LineChart title="Share of checks passed" better="higher" yMin={0} yMax={100} format={(n) => `${Math.round(n)}%`} points={p.trend.map((t) => ({ label: day(t.date), y: t.guardrailPassPct }))} />
            </Section>
            <Section title="Reply time, by day">
              <LineChart title="Average reply time" better="lower" yMin={0} format={(n) => secs(n)} points={p.trend.map((t) => ({ label: day(t.date), y: t.replyGapMs }))} />
            </Section>
          </div>
          <div className="two">
            <Section title="How calls ended">
              <Bars rows={outcomeRows} max={outMax} format={(n) => String(n)} />
            </Section>
            <Section title="Where the agent slips">
              {p.weakestChecks.length === 0 ? (
                <p className="muted">No failed checks.</p>
              ) : (
                <Bars
                  rows={p.weakestChecks.slice(0, 6).map((c) => ({ label: labelOf(c.id), value: Math.round((c.fails / c.total) * 100), sub: `${c.fails}/${c.total}` }))}
                  max={100}
                  format={(n) => `${n}% fail`}
                />
              )}
              <p className="note">The weakest rules are the next fixes to make.</p>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
