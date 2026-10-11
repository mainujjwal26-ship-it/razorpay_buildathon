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
  const rt = d.route;
  if (!rt) return null;
  const m = d.metrics;
  const callEv = d.walk.filter((w) => w.source === "call");
  const broken = m.promisesTotal - m.promisesKept;
  const q1 = [`${m.bouncesInWindow} of the last ${m.windowSize} EMIs bounced`, `${m.promisesKept} of ${m.promisesTotal} past promises kept, ${broken} broken`];
  const q2 = callEv.length ? callEv.filter((w) => w.id === "specific" || w.id === "coop").map((w) => `${w.label}: ${w.detail}`) : ["The borrower did not speak, so there is no promise."];
  const Node = ({ n, q, ev, yes }: { n: number; q: string; ev: string[]; yes: boolean }) => (
    <div className="fnode">
      <div className="fq"><span className="dnum">{n}</span><b>{q}</b><span className={`chip ${yes ? "bad" : "good"}`}>{yes ? "Yes" : "No"}</span></div>
      <ul>{ev.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
  return (
    <div className="flow">
      <Node n={1} q="Has this borrower's intent shifted toward not paying?" ev={q1} yes={rt.intentShifted} />
      <div className="farrow" aria-hidden="true">↓</div>
      <Node n={2} q="Did the borrower let the AI down on this call?" ev={q2} yes={rt.aiLetDown} />
      <div className="farrow" aria-hidden="true">Either answer is Yes → person. Both No → AI. ↓</div>
      <div className={`fout ${rt.to === "human" ? "human" : "ai"}`}>
        <span className="k">Recommendation</span>
        <b>{rt.headline}</b>
      </div>
    </div>
  );
}

export function DecisionPanel({ d }: { d: Decision }) {
  const rt = d.route;
  return (
    <section className="panel dec" aria-label="Recommended next step">
      <header className="panel-h">
        <h2>Recommended next step</h2>
      </header>
      {d.blocked || !rt ? (
        <p className="note bad">{d.blocked ?? "No recommendation could be made."}</p>
      ) : (
        <>
          <p className="dec-head">{rt.why}</p>
          <Flow d={d} />
        </>
      )}
    </section>
  );
}
