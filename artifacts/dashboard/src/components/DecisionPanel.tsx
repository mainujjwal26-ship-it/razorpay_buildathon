import type { ActionKey, Band, Decision, WalkStep } from "../lib/api";
import { inr } from "../lib/format";

export const ACTION_LABEL: Record<ActionKey, string> = {
  ai_call: "AI call",
  digital: "Payment link",
  human: "Person's call",
  field: "Field visit",
  none: "No more effort",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym}`;
export const ord = (n: number) => {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

const bandTone = (b: Band) => (b === "High" ? "good" : b === "Medium" ? "warn" : "bad");
export const BandChip = ({ band, score }: { band: Band; score: number }) => (
  <span className={`chip ${bandTone(band)}`} title="Pay-confidence: how likely the plan is to end in payment">{band} confidence · {score}</span>
);

function Flow({ d }: { d: Decision }) {
  const m = d.metrics;
  const first = d.plan?.steps[0]?.action;
  const person = first === "human" || first === "field";
  const shifted = d.result.band === "Low" || person;
  const callEv = d.walk.filter((w) => w.source === "call");
  const broken = m.promisesTotal - m.promisesKept;
  const q1 = [
    `${m.bouncesInWindow} of the last ${m.windowSize} EMIs bounced`,
    `${m.promisesKept} of ${m.promisesTotal} past promises kept`,
    ...callEv.map((w) => `This call: ${w.label.toLowerCase()}, ${w.detail.replace(/\.$/, "")}`),
    ...(callEv.length ? [] : ["This call: no borrower evidence"]),
  ];
  const q2 = [
    `${m.callsAnswered} of ${m.callsMade} AI calls answered`,
    `${broken} promise${broken === 1 ? "" : "s"} made to the AI broken`,
    ...callEv.slice(0, 2).map((w) => `This call: ${w.label.toLowerCase()}`),
  ];
  const Node = ({ n, q, ev, ans, off }: { n: number; q: string; ev: string[]; ans: string; off?: boolean }) => (
    <div className={`fnode ${off ? "off" : ""}`}>
      <div className="fq"><span className="dnum">{n}</span><b>{q}</b><span className={`chip ${off ? "neutral" : ans === "Yes" ? "bad" : "good"}`}>{off ? "Not needed" : ans}</span></div>
      <ul>{ev.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
  return (
    <div className="flow">
      <Node n={1} q="Has this borrower's intent shifted toward not paying?" ev={q1} ans={shifted ? "Yes" : "No"} />
      <div className="farrow" aria-hidden="true">{shifted ? "Yes ↓" : "No ↓"}</div>
      <Node n={2} q="Has the AI already been let down repeatedly?" ev={q2} ans={person ? "Yes" : "No"} off={!shifted} />
      <div className="farrow" aria-hidden="true">↓</div>
      <div className={`fout ${person ? "human" : "ai"}`}>
        <span className="k">Recommendation</span>
        <b>{d.plan?.headline ?? d.blocked ?? "No plan"}</b>
      </div>
    </div>
  );
}

export function DecisionPanel({ d }: { d: Decision }) {
  const plan = d.plan;
  return (
    <section className="panel dec" aria-label="Recommended next step">
      <header className="panel-h">
        <h2>Recommended next step</h2>
        <BandChip band={d.result.band} score={d.result.score} />
      </header>
      {d.blocked || !plan ? (
        <p className="note bad">{d.blocked ?? "No plan could be made."}</p>
      ) : (
        <>
          <p className="dec-head">Why: {d.because}</p>
          <Flow d={d} />
          {plan.suggestion && <div className="dsug"><b>Fix the cause, not just this EMI.</b> {plan.suggestion}</div>}
        </>
      )}
    </section>
  );
}
