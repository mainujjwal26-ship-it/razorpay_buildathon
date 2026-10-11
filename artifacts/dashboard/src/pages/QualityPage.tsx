import { useEffect, useState } from "react";
import { getQuality, type Quality } from "../lib/api";
import { By, Section, Tile } from "../components/Ui";
import { LineChart } from "../components/LineChart";
import { day, pct, secs, when } from "../lib/format";

const LOW = 20;
/** The rules that matter most. They get the big cards; the rest sit behind "Show all". */
const KEY_HARD = ["no_false_promise", "no_threats", "no_paid_claim", "identity_first"];
const KEY_JUDGEMENT = ["listened_first", "clean_close"];

type Rule = Quality["rules"][number];

function RuleCard({ rule, label, big }: { rule: Rule | undefined; label: string; big: boolean }) {
  const total = rule?.total ?? 0;
  const fails = rule?.fails ?? 0;
  const rateVal = total ? Math.round((fails / total) * 1000) / 10 : null;
  const tone = rateVal === null ? "neutral" : fails === 0 ? "good" : rateVal >= 10 ? "bad" : "warn";
  return (
    <div className={`rcard ${big ? "big" : "small"} ${tone}`}>
      <div className="rc-v">{rateVal === null ? "–" : pct(rateVal)}</div>
      <div className="rc-l">{label}</div>
      <div className="rc-s">
        {total ? `${fails} of ${total} calls breached` : "No data yet"}
        {rule && <By by={rule.by} />}
      </div>
    </div>
  );
}

function RuleGroup({ title, hint, ids, q, labelOf, type }: { title: string; hint: string; ids: string[]; q: Quality; labelOf: (id: string) => string; type: "Hard" | "Judgement" }) {
  const [open, setOpen] = useState(false);
  const all = q.checks.filter((c) => c.type === type).map((c) => c.id);
  const rest = all.filter((id) => !ids.includes(id));
  const ruleOf = (id: string) => q.rules.find((r) => r.id === id);
  return (
    <Section title={title} right={rest.length > 0 && <button className="btn ghost sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide other rules" : `Show all ${all.length} rules`}</button>}>
      <p className="note">{hint}</p>
      <div className="rgrid">
        {ids.map((id) => <RuleCard key={id} rule={ruleOf(id)} label={labelOf(id)} big />)}
      </div>
      {open && (
        <div className="rgrid small">
          {rest.map((id) => <RuleCard key={id} rule={ruleOf(id)} label={labelOf(id)} big={false} />)}
        </div>
      )}
    </Section>
  );
}

/** AI agent performance: how often Meera breaks a hard rule or a judgement rule. */
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

  if (error) return <Section title="Agent performance"><p className="note bad">{error}</p></Section>;
  if (!q) return <p className="muted">Loading…</p>;
  const c = q.core;
  const n = q.totals.scored;
  const r = q.reviewer;
  const labelOf = (id: string) => q.checks.find((x) => x.id === id)?.label ?? id;

  return (
    <div className="stack">
      <Section
        title="Can the agent be trusted?"
        right={
          <label className="toggle">
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Include sample data
          </label>
        }
      >
        <p className="note">
          {q.totals.liveCalls} live call{q.totals.liveCalls === 1 ? "" : "s"}
          {q.includesSample && <> + <b>{q.totals.sampleCalls} sample calls</b> (synthetic)</>}. Each call is checked against hard rules (must never break) and judgement rules (done well or not). Business results are on <a href="#/performance">Collections performance</a>.
          {n > 0 && n < LOW && <> <b>Low sample: only {n} scored call{n === 1 ? "" : "s"}, so read these as early signals.</b></>}
        </p>
        {n === 0 ? (
          <p className="muted">No scored calls yet. Finish a call and it is checked here.</p>
        ) : (
          <div className="tiles big two-tiles">
            <Tile label="Hard-rule breach rate" value={pct(c.hardBreachPct)} hint={`Calls with at least one hard breach: ${c.hardBreachCalls} of ${n}. Target 0%`} />
            <Tile label="Judgement-rule breach rate" value={pct(c.judgementBreachPct)} hint={`Calls with at least one judgement miss: ${c.judgementBreachCalls} of ${n}. Target under 10%`} />
          </div>
        )}
      </Section>

      {n > 0 && (
        <>
          <RuleGroup title="Hard rules" hint="Compliance and safety. The four that carry the most risk are shown first." ids={KEY_HARD} q={q} labelOf={labelOf} type="Hard" />
          <RuleGroup title="Judgement rules" hint="Quality of the conversation. Listening first is the one the empathy work depends on." ids={KEY_JUDGEMENT} q={q} labelOf={labelOf} type="Judgement" />

          <Section title="Can we trust these numbers?">
            <div className="tiles">
              <Tile
                label="Reviewer agrees with people"
                value={pct(r.agreementPct)}
                hint={r.labelledChecks === 0 ? "Mark rule results on a call's review (aim for 15 to 20 calls)" : `${r.labelledChecks} results marked on ${r.labelledCalls} calls${r.labelledChecks < LOW ? " (low sample)" : ""}. Missed breaches: ${r.falsePass}, false alarms: ${r.falseAlarm}`}
              />
              <Tile label="Reply time (median)" value={secs(c.replyMedianMs)} hint={`Slowest 10%: ${secs(c.replySlowest10Ms)}. Target under 3 s`} />
            </div>
            <details className="ledger">
              <summary>How these numbers are checked</summary>
              <ul className="how">
                <li><b>Code first.</b> Exact rules run on every transcript: payment amount against the minimum, number of links, "payment arrived" claims, threat words, promises Meera cannot keep, two questions in one turn.</li>
                <li><b>AI second.</b> An AI reviewer reads the transcript for the rest. It is the same vendor as the agent, so it is not fully independent.</li>
                <li><b>Strict by design.</b> If either the code or the AI flags a rule, the call fails that rule. Every fail shows the exact line behind it.</li>
                <li><b>People check the checker.</b> Marking each result right or wrong on a call's review is where the agreement number comes from.</li>
              </ul>
            </details>
            <details className="ledger">
              <summary>More: hard breaches by day, and by version</summary>
              <div className="two" style={{ marginTop: 12 }}>
                <LineChart title="Calls with a hard-rule breach" better="lower" yMin={0} format={(v) => `${Math.round(v)}%`} points={q.trend.map((t) => ({ label: day(t.date), y: t.hardFailPct }))} />
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
              </div>
            </details>
          </Section>
        </>
      )}
    </div>
  );
}
