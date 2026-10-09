import { useEffect, useState } from "react";
import { getQuality, type Quality } from "../lib/api";
import { By, Section, Tile } from "../components/Ui";
import { LineChart } from "../components/LineChart";
import { day, pct, secs, when } from "../lib/format";

const LOW = 20;

export function QualityPage() {
  const [sample, setSample] = useState(false);
  const [auto, setAuto] = useState(true);
  const [q, setQ] = useState<Quality | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    getQuality(sample)
      .then((x) => {
        if (auto && !sample && x.totals.scored === 0) setSample(true);
        setAuto(false);
        setQ(x);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
  }, [sample]);

  if (error) return <Section title="Quality"><p className="note bad">{error}</p></Section>;
  if (!q) return <p className="muted">Loading…</p>;
  const c = q.core;
  const low = q.totals.scored < LOW;
  const labelOf = (id: string) => q.checks.find((x) => x.id === id)?.label ?? id;
  const n = q.totals.scored;
  const r = q.reviewer;

  return (
    <div className="stack">
      <Section
        title="Quality and trust"
        right={
          <label className="toggle">
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Include sample data
          </label>
        }
      >
        <p className="note">
          {q.totals.liveCalls} live call{q.totals.liveCalls === 1 ? "" : "s"}
          {q.includesSample && <> + <b>{q.totals.sampleCalls} sample calls</b> (synthetic)</>}. Can the agent be trusted and controlled?
          {n > 0 && low && <> <b>Low sample: only {n} scored call{n === 1 ? "" : "s"}, so read these as early signals.</b></>}
        </p>
        {n === 0 ? (
          <p className="muted">No scored calls yet. Finish a call and it is checked here.</p>
        ) : (
          <div className="tiles big">
            <Tile label="Calls with a hard-rule breach" value={pct(c.hardBreachPct)} hint={`Target 0%. ${c.hardBreachCalls} of ${n} calls`} />
            <Tile label="Loan details before identity confirmed" value={pct(c.wrongDisclosurePct)} hint="Target 0%. The worst failure" />
            <Tile label="Stayed within the facts" value={pct(c.withinFactsPct)} hint="No invented numbers or reasons. Target 100%" />
            <Tile label="Judgement rules passed" value={pct(c.judgementPassPct)} hint="Tone, one question, dates, close. Target 90%+" />
            <Tile label="Reply time (median)" value={secs(c.replyMedianMs)} hint={`Slowest 10% of calls: ${secs(c.replySlowest10Ms)}. Target median under 3 s`} />
            <Tile
              label="Reviewer agrees with you"
              value={pct(r.agreementPct)}
              hint={r.labelledChecks === 0 ? "Mark rule results on the Calls tab (aim for 15 to 20 calls)" : `${r.labelledChecks} results marked on ${r.labelledCalls} calls${r.labelledChecks < LOW ? " (low sample)" : ""}. Missed breaches: ${r.falsePass}, false alarms: ${r.falseAlarm}`}
            />
          </div>
        )}
      </Section>

      {n > 0 && (
        <>
          <Section title="Rule by rule">
            <div className="tablewrap">
              <table className="grid">
                <thead>
                  <tr><th>Rule</th><th>Type</th><th>Checked by</th><th>Passed</th><th>Failed</th><th>Reviewer agreement</th></tr>
                </thead>
                <tbody>
                  {q.rules.map((x) => (
                    <tr key={x.id}>
                      <td>{labelOf(x.id)}</td>
                      <td><span className="tag">{x.type}</span></td>
                      <td><By by={x.by} /></td>
                      <td>{pct(Math.round(((x.total - x.fails) / x.total) * 1000) / 10)}</td>
                      <td className={x.fails ? "bad-t" : ""}>{x.fails} of {x.total}</td>
                      <td>{x.labelled === 0 ? "–" : `${Math.round((x.agree / x.labelled) * 100)}% (${x.labelled})`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Sorted by most failed. The rules at the top are the next fixes to make.</p>
          </Section>

          <div className="two">
            <Section title="Hard-rule breaches, by day">
              <LineChart title="Calls with a hard-rule breach" better="lower" yMin={0} format={(v) => `${Math.round(v)}%`} points={q.trend.map((t) => ({ label: day(t.date), y: t.hardFailPct }))} />
            </Section>
            <Section title="By version">
              {q.byVersion.length === 0 ? (
                <p className="muted">Versions appear for live calls. A new version is created whenever the prompt, script, guardrails or policy files change, so before and after can be compared.</p>
              ) : (
                <div className="tablewrap">
                  <table className="grid">
                    <thead><tr><th>Version</th><th>First seen</th><th>Calls</th><th>Hard breaches</th><th>Judgement passed</th></tr></thead>
                    <tbody>
                      {q.byVersion.map((v) => (
                        <tr key={v.version}>
                          <td><code>{v.version}</code></td>
                          <td>{when(v.firstSeen)}</td>
                          <td>{v.calls}</td>
                          <td>{pct(v.hardBreachPct)}</td>
                          <td>{pct(v.judgementPassPct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          <Section title="How these numbers are checked">
            <ul className="how">
              <li><b>Code first.</b> Exact rules run on every transcript: payment amount against the minimum, number of links, "payment arrived" claims, threat words, promises Meera cannot keep, two questions in one turn.</li>
              <li><b>AI second.</b> An AI reviewer reads the transcript for the rest. It is the same vendor as the agent, so it is not fully independent.</li>
              <li><b>Strict by design.</b> If either the code or the AI flags a rule, the call fails that rule. Every fail shows the exact line behind it.</li>
              <li><b>You are the check on the checker.</b> Mark each result right or wrong on the Calls tab. The reviewer-agreement number comes only from your marks, and missed breaches are counted separately.</li>
              <li><b>Small samples are labelled.</b> Under {LOW} scored calls the page says so. Sample data is synthetic and off by default once you have real calls.</li>
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
