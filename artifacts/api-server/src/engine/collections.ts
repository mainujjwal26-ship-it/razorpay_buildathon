/**
 * The six business metrics on the Collections performance tab.
 * Pure functions over call records so they can be tested on their own.
 *
 * Payment figures only exist on sample records: this build has no payment confirmation, so live calls
 * show "not connected" for collected amount, resolution rate and resolution time.
 */
export interface CollectionsRec {
  /** Which route the decision engine picked for this borrower. */
  recommendation?: "ai" | "human" | null;
  outcome: string;
  rootCause?: string | null;
  promiseDate: string | null;
  promiseAmount: number | null;
  tickets: number;
  /** Meera handed off or raised a ticket during the call. */
  handoff?: boolean;
  /** The decision layer routes this borrower to a person. */
  plannedHuman?: boolean;
  payment?: { due: number; paid: number; resolved: boolean; daysToResolve: number | null };
}

const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2) * 10) / 10;
};

/** Calls where the borrower actually spoke to Meera (right person, reviewed). */
/**
 * Forward-looking plan: how the next cycle's bounced EMIs are routed, and when
 * recovery actually lands. Both come from the records themselves — the route the
 * decision engine picked, and the day each resolved EMI was cleared.
 */
export function planShape(records: CollectionsRec[]) {
  const reviewed = records.filter((r) => r.outcome !== "unreviewed");
  const routed = reviewed.filter((r) => r.recommendation === "ai" || r.recommendation === "human");
  const ai = routed.filter((r) => r.recommendation === "ai").length;
  const human = routed.filter((r) => r.recommendation === "human").length;
  const paid = reviewed.filter((r) => r.payment?.resolved);
  const days = paid.map((r) => r.payment?.daysToResolve).filter((d): d is number => typeof d === "number");
  const last = days.length ? Math.max(...days) : 0;
  // Cumulative share of the whole book cleared by the end of each day.
  const curve: { day: number; cleared: number; share: number }[] = [];
  for (let d = 1; d <= last; d++) {
    const cleared = days.filter((x) => x <= d).length;
    curve.push({ day: d, cleared, share: reviewed.length ? cleared / reviewed.length : 0 });
  }
  return {
    cases: reviewed.length,
    routes: { ai, human, field: 0, routed: routed.length },
    resolvedShare: reviewed.length ? paid.length / reviewed.length : 0,
    curve,
  };
}

export const spoke = (r: CollectionsRec) => !["incomplete", "unreviewed", "wrong_person"].includes(r.outcome);

export function collectionsMetrics(records: CollectionsRec[]) {
  const talked = records.filter(spoke);
  const withPay = records.filter((r) => r.payment);
  const due = withPay.reduce((s, r) => s + (r.payment?.due ?? 0), 0);
  const paid = withPay.reduce((s, r) => s + (r.payment?.paid ?? 0), 0);
  const resolved = withPay.filter((r) => r.payment?.resolved);
  const days = resolved.map((r) => r.payment?.daysToResolve).filter((x): x is number => typeof x === "number");
  const clearPromise = talked.filter((r) => r.promiseDate && typeof r.promiseAmount === "number" && r.promiseAmount > 0);
  const clearReason = talked.filter((r) => r.rootCause && r.rootCause !== "declined_to_say" && r.rootCause !== "unclear");
  const inCall = talked.filter((r) => r.handoff || r.tickets > 0 || r.outcome === "escalated");
  const routed = talked.filter((r) => r.plannedHuman && !inCall.includes(r));
  return {
    talkedCalls: talked.length,
    collected: withPay.length ? { paid, due, pct: rate(paid, due), cases: withPay.length } : null,
    resolution: withPay.length ? { resolved: resolved.length, cases: withPay.length, pct: rate(resolved.length, withPay.length) } : null,
    resolutionDays: days.length ? { median: median(days), n: days.length } : null,
    promise: { clear: clearPromise.length, talked: talked.length, pct: rate(clearPromise.length, talked.length) },
    reason: { clear: clearReason.length, talked: talked.length, pct: rate(clearReason.length, talked.length) },
    handoff: { count: inCall.length + routed.length, inCall: inCall.length, routed: routed.length, talked: talked.length, pct: rate(inCall.length + routed.length, talked.length) },
  };
}
