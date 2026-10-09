import { useState } from "react";

interface Pt {
  label: string;
  y: number | null;
}

/** One-series line chart. 2px line, 8px markers, hover/focus shows the value, table view underneath. */
export function LineChart({ title, points, format, yMin, yMax, better }: { title: string; points: Pt[]; format: (n: number) => string; yMin?: number; yMax?: number; better: "higher" | "lower" }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 230, L = 52, R = 56, T = 16, B = 34;
  const ys = points.map((p) => p.y).filter((v): v is number => v !== null);
  if (ys.length < 2) return <p className="muted">Not enough days of data yet.</p>;
  const lo = yMin ?? Math.min(...ys), hi = yMax ?? Math.max(...ys);
  const span = hi - lo || 1;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / span) * (H - T - B);
  const pts = points.map((p, i) => (p.y === null ? null : { i, px: x(i), py: y(p.y), v: p.y, label: p.label }));
  const line = pts.filter(Boolean).map((p) => `${p!.px},${p!.py}`).join(" ");
  const ticks = [lo, lo + span / 2, hi];
  const last = [...pts].reverse().find(Boolean)!;
  const step = Math.ceil(points.length / 7);
  return (
    <figure className="chart">
      <figcaption><span className="sr">{title}. </span>{better === "higher" ? "Higher" : "Lower"} is better</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Latest ${format(last.v)}.`}>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" opacity=".12" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity=".7">{format(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % step === 0 || i === points.length - 1 ? <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">{p.label}</text> : null))}
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) =>
          p ? (
            <g key={p.i} tabIndex={0} onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.i)} onBlur={() => setHover(null)}>
              <circle cx={p.px} cy={p.py} r="14" fill="transparent" />
              <circle cx={p.px} cy={p.py} r="4" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
            </g>
          ) : null,
        )}
        <text x={last.px + 10} y={last.py + 4} fontSize="12" fontWeight="600" fill="currentColor">{format(last.v)}</text>
        {hover !== null && pts[hover] && (
          <g pointerEvents="none">
            <rect x={Math.min(W - 130, Math.max(4, pts[hover]!.px - 60))} y={Math.max(2, pts[hover]!.py - 44)} width="120" height="34" rx="6" fill="var(--ink)" />
            <text x={Math.min(W - 130, Math.max(4, pts[hover]!.px - 60)) + 60} y={Math.max(2, pts[hover]!.py - 44) + 14} textAnchor="middle" fontSize="11" fill="#fff" opacity=".75">{pts[hover]!.label}</text>
            <text x={Math.min(W - 130, Math.max(4, pts[hover]!.px - 60)) + 60} y={Math.max(2, pts[hover]!.py - 44) + 28} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">{format(pts[hover]!.v)}</text>
          </g>
        )}
      </svg>
      <details className="astable">
        <summary>View as table</summary>
        <table className="grid"><tbody>{points.map((p, i) => <tr key={i}><td>{p.label}</td><td>{p.y === null ? "–" : format(p.y)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
