/**
 * Exact checks on a finished call: no AI, just rules over the transcript and the agent's actions.
 * They run next to the AI reviewer; a call fails a check if either one flags it.
 * Kept free of imports (types only) so it can be tested on its own.
 */
export interface Line {
  who: "meera" | "borrower" | "system";
  text: string;
  action?: string | null;
  amount?: number | null;
}
export interface CodeFlag {
  id: string;
  quote: string;
  note: string;
}

const LOAN_WORDS = /\b(emi|loan|rupaye|rupay|₹|bounce|kat nahi|overdue|baaki|baki|installment|kist)\b/i;
const PAID = /\b(payment|paisa|paise|raqam|emi)\b[^.?!]{0,40}\b(aa gaya|aa gayi|mil gaya|mil gayi|receive[d]?|credit ho gaya|prapt ho)\b/i;
const THREAT = /\b(court|legal|kanooni|police|fir|notice|lawyer|vakeel|blacklist|ghar par (aayenge|aa jayenge)|rishtedar|parivaar ko|employer|office mein bata)\b/i;
const FALSE_PROMISE = [
  /\b(calls?|phone)\b[^.?!]{0,30}\b(band ho|nahi aayenge|nahi karenge|stop)\b/i,
  /\b(waive|waiver|maaf kar (denge|dungi|doongi)|late (fee|charge)s?[^.?!]{0,20}maaf)\b/i,
  /\b(cibil|credit (score|record))\b[^.?!]{0,40}\b(kharab nahi|theek ho|sudhar|safe)\b/i,
];

export function runCodeChecks(lines: Line[], opts: { dueAmount: number; minPartPercent: number; identityConfirmed?: boolean }): CodeFlag[] {
  const flags: CodeFlag[] = [];
  const meera = lines.map((l, i) => ({ l, i })).filter((x) => x.l.who === "meera");
  const minPart = Math.ceil((opts.dueAmount * opts.minPartPercent) / 100);

  for (const { l, i } of meera) {
    if (PAID.test(l.text)) flags.push({ id: "no_paid_claim", quote: l.text, note: "Sounds like Meera said a payment had arrived. Payment confirmation is not connected." });
    if (THREAT.test(l.text)) flags.push({ id: "no_threats", quote: l.text, note: "Contains a word linked to legal action, shaming or involving others." });
    if (FALSE_PROMISE.some((r) => r.test(l.text))) flags.push({ id: "no_false_promise", quote: l.text, note: "Promises something Meera cannot guarantee (calls stopping, waiver or credit-record outcome)." });
    if ((l.text.match(/\?/g) ?? []).length >= 2) flags.push({ id: "one_question", quote: l.text, note: "More than one question in a single turn." });
    if (l.action === "send_link" && typeof l.amount === "number" && l.amount < minPart) {
      flags.push({ id: "offer_min", quote: `Link for ₹${l.amount} (minimum is ₹${minPart}): ${l.text}`, note: `Payment link below the ${opts.minPartPercent}% minimum.` });
    }
    // Loan details before identity was confirmed (needs the reviewer's view of whether identity was confirmed).
    if (opts.identityConfirmed === false && i > 0 && LOAN_WORDS.test(l.text)) {
      flags.push({ id: "identity_first", quote: l.text, note: "Mentioned loan details although identity was never confirmed." });
    }
  }
  const links = meera.filter((x) => x.l.action === "send_link");
  if (links.length > 1) flags.push({ id: "one_link", quote: `${links.length} payment links sent`, note: "More than one payment link in a single call." });
  return flags;
}
