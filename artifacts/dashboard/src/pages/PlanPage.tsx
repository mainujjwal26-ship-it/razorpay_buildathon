import { useEffect, useState } from "react";
import { getPerformance, isDemoMode, type Performance } from "../lib/api";
import { Section } from "../components/Ui";
import { inr } from "../lib/format";

const BOOKS = [1000, 10000, 50000];
const TARGETS = [40, 50, 60];
const CALLERS = [1, 2, 3, 5];
const EMI = 5000;
/** One caller works about this many borrowers in a cycle (lender interview). */
const PER_CALLER = 400;

const crore = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} crore` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} lakh` : inr(n);
const num = (n: number) => Math.round(n).toLocaleString("en-IN");

function Pick({ label, values, value, set, unit = "" }: { label: string; values: number[]; value: number; set: (n: number) => void; unit?: string }) {
  return (
    <div>
      <span className="pl">{label}</span>
      <div className="pbtns">
        {values.map((v) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>
            {v.toLocaleString("en-IN")}{unit}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlanPage() {
  const [p, setP] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState(10000);
  const [target, setTarget] = useState(50);
  const [callers, setCallers] = useState(2);

  useEffect(() => {
    getPerformance(true)
      .then(setP)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load"));
  }, []);

  if (error) return <Section title="Plan next cycle"><p className="note bad">{error}</p></Section>;
  if (!p) return <p className="muted">Loading…</p>;
  const plan = p.plan;
  if (!plan || plan.cases === 0) return <Section title="Plan next cycle"><p className="muted">No reviewed calls yet, so there is nothing to plan from.</p></Section>;

  const per = (n: number) => (plan.cases ? n / plan.cases : 0); // share of the book
  const routed = (n: number) => (plan.routes.routed ? n / plan.routes.routed : 0);

  const pending = book * EMI;
  const targetAmt = (pending * target) / 100;
  const expected = pending * plan.resolvedShare;
  const gap = targetAmt - expected;
  const gapEmis = Math.max(0, Math.ceil(gap / EMI));
  const at = (day: number) => plan.curve.filter((c) => c.day <= day).pop()?.share ?? 0;

  // The three gaps, each in EMIs.
  const broken = Math.round(book * per(plan.promises.broken));
  const brokenPct = plan.promises.made ? Math.round((plan.promises.broken / plan.promises.made) * 100) : 0;
  const closePct = broken ? Math.min(100, Math.round((gapEmis / broken) * 100)) : 0;
  const personCalls = Math.round(book * routed(plan.routes.human));
  const needed = Math.max(1, Math.ceil(personCalls / PER_CALLER));
  const uncovered = Math.max(0, personCalls - callers * PER_CALLER);
  const reminder = Math.round(book * per(plan.reminderOnly));
  const aiCalls = Math.round(book * routed(plan.routes.ai));

  return (
    <div className="stack">
      <Section title="The cycle">
        <div className="planin">
          <Pick label="Bounced EMIs" values={BOOKS} value={book} set={setBook} />
          <Pick label="Recovery target" values={TARGETS} value={target} set={setTarget} unit="%" />
          <Pick label="Callers available" values={CALLERS} value={callers} set={setCallers} />
        </div>
      </Section>

      <Section title="How it pans out">
        <div className="mgrid three">
          <div className="metric">
            <div className="m-h">Target</div>
            <div className="m-v">{crore(targetAmt)}</div>
            <div className="m-d">{target}% of {crore(pending)}</div>
          </div>
          <div className="metric">
            <div className="m-h">The plan delivers</div>
            <div className="m-v">{crore(expected)}</div>
            <div className="m-d">{Math.round(plan.resolvedShare * 100)}% of the book</div>
          </div>
          <div className={`metric ${gap > 0 ? "bad" : "good"}`}>
            <div className="m-h">{gap > 0 ? "Short by" : "Ahead by"}</div>
            <div className="m-v">{crore(Math.abs(gap))}</div>
            <div className="m-d">{gap > 0 ? `About ${num(gapEmis)} EMIs` : "Target met"}</div>
          </div>
        </div>
        <ul className="daybars">
          {[1, 3, 7].map((d) => (
            <li key={d}>
              <span className="dl">{d === 1 ? "Next day" : d === 3 ? "By day 3" : "By day 7"}</span>
              <span className="dt">
                <i style={{ width: `${Math.max(1, at(d) * 100)}%` }} className={at(d) >= target / 100 ? "hit" : ""} />
                <u style={{ left: `${target}%` }} aria-hidden="true" />
              </span>
              <span className="dv">{crore(pending * at(d))}</span>
              <span className="dp">{Math.round(at(d) * 100)}%</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Where the gap sits">
        <div className="mgrid three">
          <div className="metric">
            <div className="m-h">The AI agent</div>
            <div className="m-v">{num(broken)} EMIs</div>
            <div className="m-d">promised on the call, then not paid ({brokenPct}% of promises)</div>
          </div>
          <div className={`metric ${uncovered > 0 ? "bad" : ""}`}>
            <div className="m-h">Our callers</div>
            <div className="m-v">{uncovered > 0 ? `${num(uncovered)} uncovered` : "Covered"}</div>
            <div className="m-d">{num(personCalls)} person calls need {needed} caller{needed === 1 ? "" : "s"}; you have {callers}</div>
          </div>
          <div className="metric">
            <div className="m-h">Where effort goes</div>
            <div className="m-v">{num(reminder)} EMIs</div>
            <div className="m-d">only forgot or hit an auto-debit failure, but get a full AI call</div>
          </div>
        </div>
      </Section>

      <Section title="What to do">
        <ol className="todo">
          <li>
            <b>Agent.</b> Follow up every broken promise on its promised date.
            {gap > 0 && broken > 0 ? ` Getting ${closePct}% of them to pay closes the gap.` : ""}
          </li>
          <li>
            <b>Team.</b> {uncovered > 0 ? `Add ${Math.ceil(uncovered / PER_CALLER)} caller${Math.ceil(uncovered / PER_CALLER) === 1 ? "" : "s"}: ${num(uncovered)} person calls have nobody.` : `The ${num(personCalls)} person calls are covered.`}
          </li>
          <li>
            <b>Allocation.</b> Send {num(reminder)} borrowers a reminder, not a call. AI calls fall from {num(aiCalls)} to {num(aiCalls - reminder)}. It saves effort; it recovers nothing extra.
          </li>
        </ol>
        <p className="note">
          From the {plan.cases}-call sample. Field visits: none in the sample, so none planned. No person-call results exist yet, so none are assumed.
          {isDemoMode() ? " Demo mode: sample data." : ""}
        </p>
      </Section>
    </div>
  );
}
