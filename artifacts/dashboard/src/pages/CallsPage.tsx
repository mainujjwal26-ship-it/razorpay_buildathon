import { useEffect, useRef, useState } from "react";
import { finishCall, getCallDetail, getCalls, type CallDetail, type CallRow } from "../lib/api";
import { DecisionPanel } from "../components/DecisionPanel";
import { Chip, Section } from "../components/Ui";
import { dateOnly, inr, mmss, ROOT_CAUSE_LABEL, when } from "../lib/format";

export function CallsPage() {
  const [rows, setRows] = useState<CallRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getCalls().then((r) => setRows(r.calls)).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);
  return (
    <Section title="Calls">
      {error && <p className="note bad">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No calls yet. Start one from the Call tab, and it will appear here after it ends.</p>}
      {rows && rows.length > 0 && (
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <th>When</th><th>Customer</th><th>Outcome</th><th>Promise</th><th>Length</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                return (
                  <tr key={r.id} onClick={() => (window.location.hash = `#/calls/${r.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && (window.location.hash = `#/calls/${r.id}`)}>
                    <td><a href={`#/calls/${r.id}`}>{when(r.startedAt)}</a></td>
                    <td>{r.customerName}</td>
                    <td><Chip outcome={r.outcome} /></td>
                    <td>{r.promiseAmount ? `${inr(r.promiseAmount)}${r.promiseDate ? ` · ${dateOnly(r.promiseDate)}` : ""}` : "–"}</td>
                    <td>{mmss(r.durationSec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function CallDetailPage({ id }: { id: string }) {
  const [d, setD] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    let stop = false;
    const load = () =>
      getCallDetail(id)
        .then((x) => {
          if (stop) return;
          setD(x);
          if (x.review) setReviewError(null);
          if (!x.review && x.ended) {
            if (!asked.current) {
              asked.current = true;
              void finishCall(id).catch((e: unknown) => !stop && setReviewError(e instanceof Error ? e.message : "Review failed"));
            }
            setWaited((w) => w + 1);
          }
        })
        .catch((e: unknown) => !stop && setError(e instanceof Error ? e.message : "Failed"));
    void load();
    const t = setInterval(() => {
      if (!stop) void load();
    }, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    if (d?.review) setWaited(0);
  }, [d?.review]);

  if (error) return <Section title="Call"><p className="note bad">{error}</p><a href="#/calls">Back to calls</a></Section>;
  if (!d) return <p className="muted">Loading…</p>;
  const r = d.review;
  const m = d.metrics;
  const t0 = d.transcript[0] ? Date.parse(d.transcript[0].ts) : 0;

  return (
    <div className="stack">
      <div className="crumbs"><a href="#/calls">← All calls</a></div>
      <Section title={`${d.customer?.name ?? "Call"} · ${when(d.startedAt)}`} right={r ? <Chip outcome={r.outcome} /> : <span className="chip neutral">Review pending</span>}>
        {!r ? (
          <div>
            <p className={reviewError || d.reviewError ? "note bad" : "muted"}>
              {reviewError || d.reviewError || (!d.ended ? "This call is still in progress." : waited > 12 ? "The review is taking longer than usual." : "Reviewing this call…")}
            </p>
            {d.ended && (reviewError || d.reviewError || waited > 12) && <button onClick={() => {
              setReviewError(null);
              setWaited(0);
              void finishCall(id).catch((e: unknown) => setReviewError(e instanceof Error ? e.message : "Review failed"));
            }}>Retry review</button>}
          </div>
        ) : (
          <>
            <p className="lead">{r.summary}</p>
            <p className="next"><b>Next step:</b> {r.nextStep || "–"}</p>
          </>
        )}
      </Section>

      {d.decision && (
        <DecisionPanel d={d.decision} />
      )}

      <div className="two">
        <div className="stack">
          {r && (
            <Section title="Key data points">
              <dl className="kv wide">
                <div><dt>Reason for bounce</dt><dd>{r.reason ?? "Not stated"}</dd></div>
                <div><dt>Root cause</dt><dd>{r.rootCause ? (ROOT_CAUSE_LABEL[r.rootCause] ?? r.rootCause) : "Not identified"}</dd></div>
                <div><dt>Promise</dt><dd>{r.promiseAmount ? `${inr(r.promiseAmount)} · ${dateOnly(r.promiseDate)}` : "None"}</dd></div>
                <div><dt>Identity confirmed</dt><dd>{r.identityConfirmed ? "Yes" : "No"}</dd></div>
                <div><dt>Tickets raised</dt><dd>{r.ticketReasons.length ? r.ticketReasons.join("; ") : "None"}</dd></div>
                <div><dt>Payment link</dt><dd>{m.actions.sendLink ? "Sent (dummy)" : "Not sent"}</dd></div>
              </dl>
            </Section>
          )}
        </div>

        <div className="stack">
          <Section title="Transcript">
            <ol className="tr">
              {d.transcript.map((l, i) => (
                <li key={i} className={l.who}>
                  <span className="t">{mmss(Math.max(0, (Date.parse(l.ts) - t0) / 1000))}</span>
                  <span className="who">{l.who === "meera" ? "Meera" : "Borrower"}</span>
                  <span className="say">{l.text}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
