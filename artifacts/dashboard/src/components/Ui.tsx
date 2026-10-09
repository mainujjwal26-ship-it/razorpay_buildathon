import type { ReactNode } from "react";
import { OUTCOME_LABEL, OUTCOME_TONE } from "../lib/format";

export const Chip = ({ outcome }: { outcome: string }) => (
  <span className={`chip ${OUTCOME_TONE[outcome] ?? "neutral"}`}>{OUTCOME_LABEL[outcome] ?? outcome}</span>
);

export const Tile = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="tile">
    <div className="tile-v">{value}</div>
    <div className="tile-l">{label}</div>
    {hint && <div className="tile-h">{hint}</div>}
  </div>
);

export const Section = ({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) => (
  <section className="panel">
    <header className="panel-h">
      <h2>{title}</h2>
      {right}
    </header>
    {children}
  </section>
);

export const Pass = ({ pass }: { pass: boolean }) => (
  <span className={`mark ${pass ? "ok" : "bad"}`} aria-label={pass ? "Passed" : "Failed"}>
    {pass ? "✓ Pass" : "✕ Fail"}
  </span>
);
