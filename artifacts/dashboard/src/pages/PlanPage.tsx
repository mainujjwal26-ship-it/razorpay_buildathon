import { useEffect, useState } from "react";
import { getPerformance, isDemoMode, type Performance } from "../lib/api";
import { Section } from "../components/Ui";
import { inr } from "../lib/format";

const BOOKS = [1000, 10000, 50000];
const TARGETS = [40, 50, 60];
const EMI = 5000;
/** One caller works about this many borrowers in a cycle (lender interview). */
const PER_CALLER = 400;

const crore = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} crore` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} lakh` : inr(n);

export function PlanPage() {
  const [p, setP] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState(10000);
  const [target, setTarget] = useState(50);

  useEffect(() => {
    getPerformance(true)
      .then(setP)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load"));
  }, []);

  if (error) return <Section title="Plan next cycle"><p className="note bad">{error}</p></Section>;
  if (!p) return <p className="muted">Loading…</p>;

  const plan = p.plan;
  if (!plan || plan.cases === 0) return <Section title="Plan next cycle"><p className="muted">No reviewed calls yet, so there is nothing to plan from.</p></Section>;

  const share = (n: number) => (plan.routes.routed ? n / plan.routes.routed : 0);
  const aiCalls = Math.round(book * share(plan.routes.ai));
  const personCalls = Math.round(book * share(plan.routes.human));
  const callers = Math.max(1, Math.ceil(personCalls / PER_CALLER));

  const pending = book * EMI;
  const targetAmount = (pending * target) / 100;
  const expectedShare = plan.resolvedShare;
  const expected = pending * expectedShare;
  const gap = targetAmount - expected;
  const dayToHit = plan.curve.find((c) => c.share >= target / 100)?.day ?? null;
  const half = plan.curve.find((c) => c.share >= expectedShare / 2)?.day ?? null;
  const extraCases = Math.max(0, Math.ceil(gap / EMI));

  return (
    <div className="stack">
      <Section title="What does the next cycle need?">
        <p className="note">
          The routing and the recovery curve below come from the {plan.cases} reviewed calls in the sample book. Set the size of
          the cycle and the target, and the plan scales to it.
        </p>
        <div className="planin">
          <div>
            <span className="pl">Bounced EMIs this cycle</span>
            <div className="pbtns">
              {BOOKS.map((b) => (
                <button key={b} type="button" aria-pressed={book === b} onClick={() => setBook(b)}>
                  {b.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="pl">Recovery target</span>
            <div className="pbtns">
              {TARGETS.map((t) => (
                <button key={t} type="button" aria-pressed={target === t} onClick={() => setTarget(t)}>
                  {t}%
                </button>
              ))}
            </div>
          </div>
          <div className="pstake">
            <span className="pl">Money in the cycle</span>
            <b>{crore(pending)}</b>
            <span className="muted small">{book.toLocaleString("en-IN")} EMIs of {inr(EMI)}</span>
          </div>
        </div>
      </Section>

      <Section title="Will the target be met?">
        <div className="mgrid three">
          <div className="metric">
            <div className="m-h">Target</div>
            <div className="m-w">What the team is being asked to recover this cycle.</div>
            <div className="m-v">{crore(targetAmount)}</div>
            <div className="m-d">{target}% of {crore(pending)}</div>
          </div>
          <div className="metric">
            <div className="m-h">The plan delivers</div>
            <div className="m-w">At the resolution rate the agent reaches in the sample book.</div>
            <div className="m-v">{crore(expected)}</div>
            <div className="m-d">{Math.round(expectedShare * 100)}% of the book, half of it by day {half ?? "–"}</div>
          </div>
          <div className={`metric ${gap > 0 ? "bad" : "good"}`}>
            <div className="m-h">{gap > 0 ? "Short by" : "Ahead by"}</div>
            <div className="m-w">{gap > 0 ? "What the plan does not reach, and must be closed." : "What the plan recovers above the target."}</div>
            <div className="m-v">{crore(Math.abs(gap))}</div>
            <div className="m-d">
              {gap > 0
                ? `About ${extraCases.toLocaleString("en-IN")} more EMIs need to clear`
                : `Target met by day ${dayToHit ?? "–"}`}
            </div>
          </div>
        </div>
      </Section>

      <Section title="When the money lands">
        <p className="note">Cumulative recovery by day, from the day each EMI actually cleared in the sample. The line stops where the sample stops.</p>
        <ul className="daybars">
          {plan.curve.map((c) => {
            const amount = pending * c.share;
            const hit = c.share >= target / 100;
            return (
              <li key={c.day}>
                <span className="dl">Day {c.day}</span>
                <span className="dt">
                  <i style={{ width: `${Math.max(1, c.share * 100)}%` }} className={hit ? "hit" : ""} />
                  <u style={{ left: `${target}%` }} aria-hidden="true" />
                </span>
                <span className="dv">{crore(amount)}</span>
                <span className="dp">{Math.round(c.share * 100)}%</span>
              </li>
            );
          })}
        </ul>
        <p className="note">
          The marker on each bar is the {target}% target.{" "}
          {dayToHit ? `The sample reaches it on day ${dayToHit}.` : "The sample never reaches it, so the gap above has to be closed another way."}
        </p>
      </Section>

      <Section title="What the team does today">
        <div className="mgrid three">
          <div className="metric">
            <div className="m-h">AI calls to place</div>
            <div className="m-w">Borrowers the agent keeps, because intent has not shifted and the call went well.</div>
            <div className="m-v">{aiCalls.toLocaleString("en-IN")}</div>
            <div className="m-d">{Math.round(share(plan.routes.ai) * 100)}% of the cycle</div>
          </div>
          <div className="metric">
            <div className="m-h">Calls for a person</div>
            <div className="m-w">Borrowers whose intent has shifted, or who let the agent down on the call.</div>
            <div className="m-v">{personCalls.toLocaleString("en-IN")}</div>
            <div className="m-d">{callers} caller{callers === 1 ? "" : "s"} at ~{PER_CALLER} borrowers each</div>
          </div>
          <div className="metric">
            <div className="m-h">Field visits</div>
            <div className="m-w">Borrowers who have stopped answering the phone altogether.</div>
            <div className="m-v">0</div>
            <div className="m-d">No borrower in the sample stops answering, so this route is never triggered</div>
          </div>
        </div>
        <p className="note">
          Sample figures. The route mix and the recovery curve come from the {plan.cases}-call sample book; the ratio of about{" "}
          {PER_CALLER} borrowers per caller is from a collections interview at an Indian lender.
          {isDemoMode() ? " Demo mode: nothing here is a live borrower." : ""}
        </p>
      </Section>
    </div>
  );
}
