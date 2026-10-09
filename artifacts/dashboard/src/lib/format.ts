export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
export const inr = (n: number | null) => (n === null ? "–" : `₹${n.toLocaleString("en-IN")}`);
export const pct = (n: number | null) => (n === null ? "–" : `${n % 1 === 0 ? n : n.toFixed(1)}%`);
export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–";
export const day = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
export const dateOnly = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }) : "–";

export const OUTCOME_LABEL: Record<string, string> = {
  promise_to_pay: "Promised full EMI",
  part_payment: "Agreed part payment",
  link_sent: "Payment link sent",
  no_commitment: "No commitment",
  refused: "Refused",
  wrong_person: "Wrong person",
  escalated: "Passed to team",
  incomplete: "No conversation",
  unreviewed: "Review pending",
};
export const ROOT_CAUSE_LABEL: Record<string, string> = {
  timing: "Salary or income arrives after the EMI date",
  one_off_expense: "One-off expense (medical, family, travel)",
  forgot_or_autodebit: "Forgot, or auto-debit failed",
  hardship: "Lasting hardship (job loss, illness)",
  how_to_pay: "Did not know how to pay",
  dispute: "Disputes the loan or a charge",
  declined_to_say: "Preferred not to say",
  unclear: "Reason stayed unclear",
};
export const OUTCOME_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  promise_to_pay: "good",
  part_payment: "good",
  link_sent: "good",
  no_commitment: "warn",
  escalated: "warn",
  refused: "bad",
  wrong_person: "neutral",
  incomplete: "neutral",
  unreviewed: "neutral",
};
export const SENTIMENT_LABEL: Record<string, string> = { calm: "Calm", worried: "Worried", irritated: "Irritated", hostile: "Hostile" };
