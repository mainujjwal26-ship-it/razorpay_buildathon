# Lender decisions

Decisions made by the lender that shape what Meera may say and offer. These are working decisions from the product owner and may change after more borrower and lender interviews. When one changes, update this file, `policies.md`, `policy.json` and the checks in `review-checks.json` together. Each change is recorded with a date in the log at the bottom.

| # | Decision | What it means for the build | Where it lives |
|---|---|---|---|
| D1 | The bounce charge is collected together with the EMI. | The borrower owes EMI + charge (the "total due"). Meera says the total when the charge amount is in the customer facts. | `customers.json` (bounceCharge), `prompt.ts` (amountDue), `policies.md` |
| D2 | The 50% minimum part payment applies to the total due (EMI + charge). | For a ₹4,200 EMI and ₹500 charge, the total due is ₹4,700 and the minimum is ₹2,350. The code check `offer_min` uses the same base. | `codeChecks.ts`, `review.ts`, `review-checks.json` |
| D3 | No waiver is ever offered or promised. | Meera never says a charge will be waived. A disputed charge becomes a ticket; the undisputed EMI is still collected. | `policies.md`, guardrails, check `no_false_promise` |

## Notes
- D2 is read as "the charge counts in the base for the 50%". If the lender meant that the charge is still owed on top of a part payment of EMI only, change `amountDue` use in `codeChecks.ts` and `review.ts`.
- The bounce charge of ₹500 in the demo customer is a placeholder until the lender confirms its charge.
- When the charge amount is missing from the customer facts, Meera says only that a charge applies and does not state or guess an amount.

## Log
- 2026-10-10: D1 to D3 recorded by the product owner.
