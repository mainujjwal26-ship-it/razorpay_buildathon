import { useEffect, useRef, useState } from "react";
import { finishCall, getCallDetail, getCalls, sendVerdict, type CallDetail, type CallRow } from "../lib/api";
import { By, Chip, Pass, Section, Tile } from "../components/Ui";
import { dateOnly, inr, mmss, SENTIMENT_LABEL, secs, when } from "../lib/format";

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
                <th>When</th><th>Customer</th><th>Outcome</th><th>Mood</th><th>Promise</th><th>Length</th><th>Reply time</th><th>Rules</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const failed = r.checks.filter((c) => !c.pass).length;
                return (
                  <tr key={r.id} onClick={() => (window.location.hash = `#/calls/${r.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && (window.location.hash = `#/calls/${r.id}`)}>
                    <td><a href={`#/calls/${r.id}`}>{when(r.startedAt)}</a></td>
                    <td>{r.customerName}</td>
                    <td><Chip outcome={r.outcome} /></td>
                    <td>{r.sentiment ? SENTIMENT_LABEL[r.sentiment] : "–"}</td>
                    <td>{r.promiseAmount ? `${inr(r.promiseAmount)}${r.promiseDate ? ` · ${dateOnly(r.promiseDate)}` : ""}` : "–"}</td>
                    <td>{mmss(r.durationSec)}</td>
                    <td>{secs(r.replyGapMs)}</td>
                    <td>{r.checks.length === 0 ? "–" : failed === 0 ? <span className="mark ok">✓ All pass</span> : <span className="mark bad">✕ {failed} failed</span>}</td>
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
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const mark = (checkId: string, agree: boolean) => {
    setVerdicts((v) => ({ ...v, [checkId]: agree }));
    void sendVerdict(id, checkId, agree).catch(() => setVerdicts((v) => { const n = { ...v }; delete n[checkId]; return n; }));
  };
  useEffect(() => {
    if (d) setVerdicts((v) => ({ ...d.verdicts, ...v }));
  }, [d?.verdicts]);

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
  const failed = r ? r.checks.filter((c) => !c.pass) : [];

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

      <div className="two">
        <div className="stack">
          {r && (
            <Section title="Key data points">
              <dl className="kv wide">
                <div><dt>Reason for bounce</dt><dd>{r.reason ?? "Not stated"}</dd></div>
                <div><dt>Promise</dt><dd>{r.promiseAmount ? `${inr(r.promiseAmount)} · ${dateOnly(r.promiseDate)}` : "None"}</dd></div>
                <div><dt>Borrower mood</dt><dd>{SENTIMENT_LABEL[r.sentiment]}</dd></div>
                <div><dt>Identity confirmed</dt><dd>{r.identityConfirmed ? "Yes" : "No"}</dd></div>
                <div><dt>Tickets raised</dt><dd>{r.ticketReasons.length ? r.ticketReasons.join("; ") : "None"}</dd></div>
                <div><dt>Payment link</dt><dd>{m.actions.sendLink ? "Sent (dummy)" : "Not sent"}</dd></div>
              </dl>
            </Section>
          )}
          {r && r.checks.length > 0 && (
            <Section title="Rule checks" right={<span className={`mark ${failed.length ? "bad" : "ok"}`}>{failed.length ? `✕ ${failed.length} failed` : "✓ All pass"}</span>}>
              <ul className="checks">
                {r.checks.map((c) => (
                  <li key={c.id}>
                    <Pass pass={c.pass} />
                    <div className="ck">
                      <div>{c.label} <span className="tag">{c.type}</span> <By by={c.by} /></div>
                      {!c.pass && c.note && <div className="muted small">{c.note}</div>}
                      {!c.pass && c.quote && <blockquote className="quote">{c.quote}</blockquote>}
                      <div className="verdict" role="group" aria-label={`Is this result right? ${c.label}`}>
                        <span className="muted small">Is this result right?</span>
                        <button type="button" aria-pressed={verdicts[c.id] === true} className={verdicts[c.id] === true ? "on" : ""} onClick={() => mark(c.id, true)}>✓ Yes</button>
                        <button type="button" aria-pressed={verdicts[c.id] === false} className={verdicts[c.id] === false ? "on bad" : ""} onClick={() => mark(c.id, false)}>✕ No</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="note">Each rule is checked by exact code, by an AI reviewer, or both (a flag from either counts). Either can be wrong, so mark each result. The transcript is the evidence.{d.version && <> Content version <code>{d.version}</code>.</>}</p>
            </Section>
          )}
        </div>

        <div className="stack">
          <Section title="Call metrics">
            <div className="tiles">
              <Tile label="Length" value={mmss(m.durationSec)} />
              <Tile label="Borrower turns" value={m.borrowerTurns} />
              <Tile label="Avg reply time" value={secs(m.replyGapMs)} hint={`slowest ${secs(m.slowestReplyMs)}`} />
              <Tile label="Model time" value={secs(m.llmMs)} />
              <Tile label="Speech to text" value={secs(m.sttMs)} />
              <Tile label="Text to speech" value={secs(m.ttsMs)} />
              <Tile label="Silences" value={m.silences} />
              <Tile label="Errors" value={m.errors} />
            </div>
            <p className="note">Voice: {m.speechMode === "sarvam" ? "Sarvam" : "browser"}.</p>
          </Section>
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
