import { useEffect, useState } from "react";
import { getCallDetail, getCalls, previewDecision, type CallConfig, type CallFactsInput, type Decision } from "../lib/api";
import { DecisionPanel, BandChip, ord } from "../components/DecisionPanel";
import { Section } from "../components/Ui";
import { inr } from "../lib/format";

interface Scenario {
  key: string;
  title: string;
  say: string;
  facts: CallFactsInput;
}
const SCENARIOS: Scenario[] = [
  {
    key: "fits",
    title: "A specific promise that fits his payday",
    say: "“My salary comes on the 9th. I’ll pay ₹4,200 on the 10th.”",
    facts: { outcome: "promise_to_pay", rootCause: "timing", promiseDate: "2026-10-10", promiseAmount: 4200, cooperation: "cooperative" },
  },
  {
    key: "vague",
    title: "A vague answer and a new reason",
    say: "“Something came up this month. I’ll try to pay next week.”",
    facts: { outcome: "no_commitment", rootCause: "one_off_expense", promiseDate: null, promiseAmount: null, cooperation: "evasive" },
  },
];

const reasonText: Record<string, string> = { timing: "Salary timing", one_off_expense: "One-off expense", hardship: "Hardship", forgot_or_autodebit: "Forgot or auto-debit failed", how_to_pay: "Did not know how to pay", dispute: "Dispute", declined_to_say: "Did not say", unclear: "Unclear" };

export function DecisionPage({ config }: { config: CallConfig }) {
  const customer = config.customers[0];
  const [results, setResults] = useState<Record<string, Decision>>({});
  const [selected, setSelected] = useState(SCENARIOS[0]!.key);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<{ id: string; decision: Decision } | null>(null);

  useEffect(() => {
    if (!customer) return;
    let stop = false;
    Promise.all(SCENARIOS.map((s) => previewDecision(customer.id, s.facts).then((r) => [s.key, r.decision] as const)))
      .then((pairs) => !stop && setResults(Object.fromEntries(pairs)))
      .catch((e: unknown) => !stop && setError(e instanceof Error ? e.message : "Could not load"));
    getCalls()
      .then(async (r) => {
        const row = r.calls.find((c) => c.source === "live" && c.outcome !== "unreviewed");
        if (!row) return;
        const d = await getCallDetail(row.id);
        if (!stop && d.decision) setLatest({ id: row.id, decision: d.decision });
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [customer?.id]);

  if (!customer) return <p className="muted">No customer configured.</p>;
  const current = selected === "latest" ? latest?.decision : results[selected];
  const h = Object.values(results)[0]?.history;

  return (
    <div className="stack">
      <Section title={`${customer.name}: same history, different call`}>
        <p className="lead">
          {customer.displayName} owes {inr(customer.emiAmount)} plus a {inr(customer.bounceCharge ?? 0)} bounce charge. His EMI falls due on the {h ? ord(h.profile.emiDueDay) : "5th"}; his salary arrives around the {h ? `${ord(h.profile.salaryDayFrom)} to ${ord(h.profile.salaryDayTo)}` : "8th to 10th"}.
          The history stays fixed. Only what he says on the call changes, and the recommended plan changes with it.
        </p>
        {error && <p className="note bad">{error}</p>}
        <div className="scen" role="group" aria-label="Choose what he says on the call">
          {SCENARIOS.map((s) => {
            const d = results[s.key];
            return (
              <button key={s.key} aria-pressed={selected === s.key} onClick={() => setSelected(s.key)}>
                <b>{s.title}</b>
                <div className="say">{s.say}</div>
                <div className="facts">
                  <span>Reason: {reasonText[s.facts.rootCause ?? ""] ?? "Not stated"}</span>
                  <span>Promise: {s.facts.promiseAmount ? `${inr(s.facts.promiseAmount)} on the ${ord(Number(s.facts.promiseDate?.slice(8, 10)))}` : "None"}</span>
                  <span>Tone: {s.facts.cooperation}</span>
                </div>
                {d && (
                  <div style={{ marginTop: 10 }}>
                    <BandChip band={d.result.band} score={d.result.score} />
                    <div style={{ marginTop: 6, fontWeight: 600 }}>→ {d.plan?.headline ?? d.blocked}</div>
                  </div>
                )}
              </button>
            );
          })}
          {latest && (
            <button aria-pressed={selected === "latest"} onClick={() => setSelected("latest")}>
              <b>Your latest real call</b>
              <div className="say">Reviewed from an actual call on the Call tab.</div>
              <div style={{ marginTop: 10 }}>
                <BandChip band={latest.decision.result.band} score={latest.decision.result.score} />
                <div style={{ marginTop: 6, fontWeight: 600 }}>→ {latest.decision.plan?.headline ?? latest.decision.blocked}</div>
              </div>
            </button>
          )}
        </div>
      </Section>
      {current ? <DecisionPanel d={current} /> : !error && <p className="muted">Loading…</p>}
      {selected === "latest" && latest && <a href={`#/calls/${latest.id}`}>Open that call’s full review</a>}
    </div>
  );
}
