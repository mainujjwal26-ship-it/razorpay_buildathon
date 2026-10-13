import { useEffect, useState } from "react";
import { isDemoMode, getQuality, type Quality } from "../lib/api";
import { By, Section, Tile } from "../components/Ui";
import { pct } from "../lib/format";

const LOW = 20;
/** The rules that matter most. They get the big cards; the rest sit behind "Show all". */
const KEY_HARD = ["no_false_promise", "no_threats", "no_paid_claim", "identity_first"];
const KEY_JUDGEMENT = ["listened_first", "clean_close"];

type Rule = Quality["rules"][number];

function RuleCard({ rule, label, big, by }: { rule: Rule | undefined; label: string; big: boolean; by?: string }) {
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
        {(by ?? rule?.by) && <By by={(by ?? rule?.by) as string} />}
      </div>
    </div>
  );
}

function RuleGroup({ title, hint, ids, q, labelOf, type }: { title: string; hint: string; ids: string[]; q: Quality; labelOf: (id: string) => string; type: "Hard" | "Judgement" }) {
  const rest = q.checks.filter((c) => c.type === type && !ids.includes(c.id)).map((c) => c.id);
  const ruleOf = (id: string) => q.rules.find((r) => r.id === id);
  const byOf = (id: string) => q.checks.find((c) => c.id === id)?.by;
  return (
    <Section title={title}>
      <p className="note">{hint}</p>
      <div className="rgrid">
        {ids.map((id) => <RuleCard key={id} rule={ruleOf(id)} label={labelOf(id)} big by={byOf(id)} />)}
      </div>
      {rest.length > 0 && (
        <div className="rgrid small">
          {rest.map((id) => <RuleCard key={id} rule={ruleOf(id)} label={labelOf(id)} big={false} by={byOf(id)} />)}
        </div>
      )}
    </Section>
  );
}

/** AI agent performance: how often Meera breaks a hard rule or a judgement rule. */
export function QualityPage() {
  const [sample, setSample] = useState(isDemoMode);
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
          <RuleGroup title="Hard rules" hint="Compliance and safety. The four that carry the most risk are shown larger." ids={KEY_HARD} q={q} labelOf={labelOf} type="Hard" />
          <RuleGroup title="Judgement rules" hint="Quality of the conversation. Listening first is the one the empathy work depends on." ids={KEY_JUDGEMENT} q={q} labelOf={labelOf} type="Judgement" />

        </>
      )}
    </div>
  );
}
