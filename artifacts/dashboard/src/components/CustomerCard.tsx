import type { FullCustomer } from "../lib/api";
import { inr } from "../lib/format";

export function CustomerCard({ customer, lender }: { customer: FullCustomer; lender: string }) {
  const rows: [string, string][] = [
    ["EMI amount", inr(customer.emiAmount)],
    ["EMI due", customer.emiDueDate],
    ["Days past due", String(customer.daysPastDue)],
    ["EMIs paid so far", String(customer.emisPaid ?? "–")],
    ["Last payment", customer.lastPayment ?? "–"],
    ["Language", customer.language ?? "–"],
  ];
  return (
    <aside className="panel cust" aria-label="Customer details">
      <header className="panel-h">
        <h2>Customer</h2>
        <span className="chip bad">EMI bounced</span>
      </header>
      <div className="cust-name">{customer.name}</div>
      <div className="muted small">{lender} · personal loan</div>
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="note">Meera may state only these facts and the policy notes. Anything else becomes a ticket.</p>
    </aside>
  );
}
