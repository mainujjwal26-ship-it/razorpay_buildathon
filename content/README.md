# /content: everything the agent says or believes

Edit these files to change behaviour. No code change or rebuild is needed; the API server reads them on every call.

| File | What it controls |
| --- | --- |
| `script.md` | Fixed lines (F1, F2 ...), stage cards, hard moments, voice sheet. Exported from the Call Script doc. |
| `guardrails.json` | The 61 guardrails (48 Hard, 13 Judgement), grouped. Exported from the flow map. |
| `policy.json` | Lender's rules: minimum split, days, offer rounds, calls per week, hours, `testMode`. |
| `talking.json` | Pace, pauses, repeats, sentence length. |
| `customers/customers.json` | Demo borrowers. These facts are the only loan facts the agent may state. |
| `prompts/agent.md` | The agent's instructions. `{{slots}}` are filled from the files above. |

Rules the code can check itself (calling hours so far; offers, links and "paid" later) are enforced in `artifacts/api-server/src/engine/rules.ts`, not in the prompt.
