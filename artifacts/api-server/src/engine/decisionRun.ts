import { loadDecisionRules, loadHistory, loadPolicy, type Customer } from "../lib/content";
import { decide, type CallFacts, type Cooperation } from "./decision";
import type { CallReview } from "./review";

/** Joins the borrower's history with the facts of a call. Returns null when there is no history for this borrower. */
export function decisionFor(customer: Customer, facts: CallFacts) {
  const history = loadHistory(customer.id);
  if (!history) return null;
  const decision = decide({ customer, history, call: facts, rules: loadDecisionRules(), minPartPercent: loadPolicy().minPartPaymentPercent });
  return { ...decision, history: { sample: history.sample === true, note: history.note ?? null, profile: history.profile, ledger: history.ledger, calls: history.calls } };
}

export function factsOfReview(review: CallReview): CallFacts {
  const cooperation: Cooperation =
    review.cooperation ?? (review.sentiment === "hostile" || review.outcome === "refused" ? "hostile" : review.sentiment === "irritated" && review.outcome === "no_commitment" ? "evasive" : "cooperative");
  return { outcome: review.outcome, rootCause: review.rootCause ?? null, promiseDate: review.promiseDate, promiseAmount: review.promiseAmount, cooperation };
}
