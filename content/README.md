# /content: everything the agent says or believes

Edit these files to change behaviour. No code change or rebuild is needed; the API server reads them on every call.

| File | What it controls |
| --- | --- |
| `script.md` | Fixed lines (F1, F2 ...), stage cards, hard moments, voice sheet. Exported from the Call Script doc. |
| `guardrails.json` | The 56 guardrails (43 Hard, 13 Judgement), grouped. Exported from the flow map. |
| `policy.json` | Lender's rules: minimum part payment (50%), calling hours (unused by the prompt), `testMode`. |
| `talking.json` | Pace, pauses, repeats, sentence length. |
| `policies.md` | Policy notes Meera may quote; anything else becomes a ticket. |
| `customers/customers.json` | Demo borrowers. These facts are the only loan facts the agent may state. |
| `prompts/agent.md` | The agent's instructions. `{{slots}}` are filled from the files above. |

Rules the code can check itself (calling hours so far; offers, links and "paid" later) are enforced in `artifacts/api-server/src/engine/rules.ts`, not in the prompt.
