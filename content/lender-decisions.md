# Lender decisions

Decisions made by the lender that shape what Meera may say and offer. These are working decisions from the product owner and may change after more borrower and lender interviews. When one changes, update this file, `policies.md`, `policy.json` and the checks in `review-checks.json` together. Each change is recorded with a date in the log at the bottom.

| # | Decision | What it means for the build | Where it lives |
|---|---|---|---|
| D1 | The bounce charge is collected together with the EMI. | The borrower owes EMI + charge (the "total due"). Meera says the total when the charge amount is in the customer facts. | `customers.json` (bounceCharge), `prompt.ts` (amountDue), `policies.md` |
| D2 | The 50% minimum part payment is 50% of the EMI. The bounce charge is still owed on top and a part payment does not reduce it. | For a ₹4,200 EMI and ₹500 charge, the minimum part payment is ₹2,100 and the total due stays ₹4,700, so the rest (₹2,600 after a ₹2,100 part payment) is paid by the agreed date. The code check `offer_min` uses 50% of the EMI. | `codeChecks.ts`, `review.ts`, `review-checks.json` |
| D3 | No waiver is ever offered or promised. | Meera never says a charge will be waived. A disputed charge becomes a ticket; the undisputed EMI is still collected. | `policies.md`, guardrails, check `no_false_promise` |

## Notes
- D2 was confirmed on 2026-10-10: the charge is still owed on top of a part payment of the EMI. The earlier reading (the charge counted inside the 50% base) was dropped.
- The bounce charge of ₹500 in the demo customer is a placeholder until the lender confirms its charge.
- When the charge amount is missing from the customer facts, Meera says only that a charge applies and does not state or guess an amount.

## Log
- 2026-10-10: D1 to D3 recorded by the product owner.
- 2026-10-10: D2 clarified: the 50% is of the EMI alone; the charge is still owed on top.
