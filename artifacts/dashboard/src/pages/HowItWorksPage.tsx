import type React from "react";

/* The whole journey as one flowchart, drawn in SVG (no libraries). */

const W = 190;

function Person({ x, y, headset = false, tone = "#1a63d6" }: { x: number; y: number; headset?: boolean; tone?: string }) {
  return (
    <g transform={`translate(${x},${y})`} stroke={tone} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="0" cy="-7" r="6.5" fill="#fff" />
      <path d="M-13 14c0-8 6-12 13-12s13 4 13 12z" fill="#fff" />
      {headset && <path d="M-8-8a8 8 0 0 1 16 0M8-6v5l-4 3" />}
    </g>
  );
}

function Badge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r="11" fill="#0d1b2e" />
      <text className="fc-n" textAnchor="middle" y="4.5">{n}</text>
    </g>
  );
}

function Box({ cx, cy, w = W, h = 88, cls, icon, lines, sub, dashed }: {
  cx: number; cy: number; w?: number; h?: number; cls: string; icon: React.ReactNode; lines: string[]; sub?: string; dashed?: boolean;
}) {
  const tx = cx - w / 2 + 52;
  const ty = cy - (lines.length * 16 + (sub ? 16 : 0)) / 2 + 12;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="12" className={`fc-box ${cls}`} strokeDasharray={dashed ? "5 4" : undefined} />
      <g transform={`translate(${cx - w / 2 + 26},${cy})`}>{icon}</g>
      {lines.map((l, i) => <text key={i} x={tx} y={ty + i * 16} className="fc-t">{l}</text>)}
      {sub && <text x={tx} y={ty + lines.length * 16 + 1} className="fc-s">{sub}</text>}
    </g>
  );
}

function Outcome({ cx, cy, cls, icon, lines, sub }: { cx: number; cy: number; cls: string; icon: React.ReactNode; lines: string[]; sub: string }) {
  const w = 136, h = 108;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="12" className={`fc-box ${cls}`} />
      <g transform={`translate(${cx},${cy - 28})`}>{icon}</g>
      {lines.map((l, i) => <text key={i} x={cx} y={cy + 2 + i * 15} textAnchor="middle" className="fc-t">{l}</text>)}
      <text x={cx} y={cy + 2 + lines.length * 15 + 3} textAnchor="middle" className="fc-s">{sub}</text>
    </g>
  );
}

function Diamond({ cx, cy, lines }: { cx: number; cy: number; lines: string[] }) {
  return (
    <g>
      <polygon points={`${cx},${cy - 62} ${cx + 92},${cy} ${cx},${cy + 62} ${cx - 92},${cy}`} className="fc-box fc-dec" />
      {lines.map((l, i) => <text key={i} x={cx} y={cy - (lines.length - 1) * 8 + i * 16 + 4} textAnchor="middle" className="fc-t">{l}</text>)}
    </g>
  );
}

function Bubble({ x, y, w, who, lines }: { x: number; y: number; w: number; who: string; lines: string[] }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={20 + lines.length * 15} rx="10" className="fc-bub" />
      <text x={x + 10} y={y + 15} className="fc-who">{who}</text>
      {lines.map((l, i) => <text key={i} x={x + 10} y={y + 30 + i * 15} className="fc-s fc-q">{l}</text>)}
    </g>
  );
}

const ic = (d: string, tone = "#0d1b2e") => (
  <g fill="none" stroke={tone} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></g>
);

export function HowItWorksPage() {
  return (
    <div className="stack">
      <section className="panel">
        <h2>How a bounced EMI becomes a resolved call, and what the lender sees</h2>
        <p className="muted" style={{ margin: "6px 0 14px" }}>
          Follow the numbers 1 to 6. Click a screen at the bottom to open it.
        </p>
        <div className="fcwrap">
          <figure style={{ margin: 0 }}>
            <svg viewBox="0 0 1300 820" role="img" className="fc"
              aria-label="Flowchart: a bounced EMI triggers a call from Meera, who first checks she has the right person, then states only lender facts. The borrower promises to pay, offers a part payment, takes a payment link, or the case goes to a human. Every call is reviewed automatically and shows up on the Calls, Performance and Quality screens.">
              <defs>
                <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill="#6b7788" />
                </marker>
              </defs>

              {/* arrows, row A */}
              <g className="fc-line">
                <path className="fc-arr" d="M200 100H235" /><path className="fc-arr" d="M425 100H478" /><path className="fc-arr" d="M662 100H710" /><path className="fc-arr" d="M920 100H983" />
                {/* D1 no -> wrong person */}
                <path className="fc-arr" d="M570 162V339" />
                {/* D2 -> outcomes bus */}
                <path d="M1075 162V285M765 285H1215" /><path className="fc-arr" d="M765 285V331" /><path className="fc-arr" d="M915 285V331" /><path className="fc-arr" d="M1065 285V331" /><path className="fc-arr" d="M1215 285V331" />
                {/* all ends -> call ends */}
                <path d="M570 429V485H1215M765 439V485M915 439V485M1065 439V485M1215 439V485" />
                <path className="fc-arr" d="M1000 485V520" />
                <path className="fc-arr" d="M895 570H842" /><path className="fc-arr" d="M630 570H577" strokeDasharray="5 4" />
                <path d="M735 618V668M620 668H1080M735 668H850" /><path className="fc-arr" d="M620 668V705" /><path className="fc-arr" d="M850 668V705" /><path className="fc-arr" d="M1080 668V705" />
              </g>
              <text x="672" y="90" className="fc-lbl">Yes</text>
              <text x="556" y="196" className="fc-lbl" textAnchor="end">No</text>

              {/* Row A */}
              <Box cx={105} cy={100} cls="fc-n1" lines={["EMI auto-debit", "bounces"]} sub="Borrower is overdue"
                icon={ic("M0-13L14 12H-14zM0-4v8M0 8v.5", "#b3261e")} />
              <Box cx={330} cy={100} cls="fc-n1" lines={["Meera calls", "within minutes"]} sub="Hindi / Hinglish"
                icon={<Person x={0} y={0} headset />} />
              <Diamond cx={570} cy={100} lines={["Right person?", "(identity first)"]} />
              <Box cx={815} cy={100} w={210} cls="fc-n1" lines={["States only the", "lender's facts"]} sub="Amount, due date, delay"
                icon={ic("M-12-10h24v16h-14l-6 6v-6h-4z")} />
              <Diamond cx={1075} cy={100} lines={["What does the", "borrower say?"]} />

              {/* conversation bubbles */}
              <Bubble x={225} y={186} w={232} who="MEERA" lines={["“Namaste, kya main Ujjwal ji", "se baat kar rahi hoon?”"]} />
              <Bubble x={588} y={186} w={128} who="BORROWER" lines={["“Haan, boliye.”"]} />
              <Bubble x={732} y={186} w={250} who="MEERA" lines={["“Aapki ₹4,200 ki EMI 5 tareekh", "ko bounce hui hai.”"]} />

              {/* Row B */}
              <Box cx={570} cy={385} cls="fc-n1" h={88} lines={["Wrong person:", "polite close"]} sub="No loan details shared"
                icon={<Person x={0} y={0} tone="#6b7788" />} />
              <Outcome cx={765} cy={385} cls="fc-ok" lines={["Promise to pay"]} sub="Date and amount"
                icon={ic("M-14-2l9 9L14-9", "#14653d")} />
              <Outcome cx={915} cy={385} cls="fc-ok" lines={["Part payment"]} sub="Not below minimum"
                icon={ic("M-14 9a14 14 0 0 1 28 0M0 9l8-12", "#14653d")} />
              <Outcome cx={1065} cy={385} cls="fc-ok" lines={["One payment link"]} sub="Sent only once"
                icon={ic("M-3 3a6 6 0 0 0 8 0l6-6a6 6 0 0 0-8-8l-2 2M3-3a6 6 0 0 0-8 0l-6 6a6 6 0 0 0 8 8l2-2", "#14653d")} />
              <Outcome cx={1215} cy={385} cls="fc-esc" lines={["Needs a human"]} sub="Ticket + summary"
                icon={<g><Person x={-9} y={2} tone="#1a63d6" /><path d="M6-6h12m-4-4l4 4-4 4" fill="none" stroke="#1a63d6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></g>} />

              {/* Row C */}
              <Box cx={1000} cy={570} w={210} cls="fc-n1" lines={["Call ends"]} sub="Transcript saved, timed"
                icon={ic("M-13 5c8-9 18-9 26 0l-5 5-5-3v-4a14 14 0 0 0-6 0v4l-5 3z")} />
              <Box cx={735} cy={570} w={210} cls="fc-rev" h={96} lines={["Auto-reviewed"]} sub="Summary + rule checks"
                icon={ic("M0-14l13 5v8c0 8-6 13-13 15-7-2-13-7-13-15v-8zM-5 1l4 4 7-8", "#1a63d6")} />
              <Box cx={470} cy={570} w={210} cls="fc-node" dashed lines={["Human spot-check"]} sub="Marks results right / wrong"
                icon={<Person x={0} y={0} tone="#0d1b2e" />} />

              {/* Row D: dashboards (clickable) */}
              <a href="#/calls" className="fc-link"><g>
                <rect x={520} y={705} width={200} height={80} rx="12" className="fc-box fc-out" />
                <g transform="translate(548,745)">{ic("M-12-8h24M-12 0h24M-12 8h14")}</g>
                <text x={574} y={741} className="fc-t">Calls</text><text x={574} y={759} className="fc-s">Each call, reviewed</text>
              </g></a>
              <a href="#/performance" className="fc-link"><g>
                <rect x={750} y={705} width={200} height={80} rx="12" className="fc-box fc-out" />
                <g transform="translate(778,745)">{ic("M-12 12V0M-4 12V-12M4 12V-4M12 12V4")}</g>
                <text x={804} y={741} className="fc-t">Performance</text><text x={804} y={759} className="fc-s">Money recovered</text>
              </g></a>
              <a href="#/quality" className="fc-link"><g>
                <rect x={980} y={705} width={200} height={80} rx="12" className="fc-box fc-out" />
                <g transform="translate(1008,745)">{ic("M0-13l12 5v7c0 7-5 12-12 14-7-2-12-7-12-14v-7zM-4 1l3 3 6-7")}</g>
                <text x={1034} y={741} className="fc-t">Quality</text><text x={1034} y={759} className="fc-s">Are the rules holding?</text>
              </g></a>

              {/* step badges */}
              <Badge x={24} y={64} n={1} />
              <Badge x={249} y={64} n={2} />
              <Badge x={990} y={44} n={3} />
              <Badge x={1150} y={336} n={4} />
              <Badge x={640} y={526} n={5} />
              <Badge x={534} y={689} n={6} />

              {/* legend */}
              <g transform="translate(30,330)">
                <text className="fc-lh" y="0">KEY</text>
                <polygon points="12,14 24,26 12,38 0,26" className="fc-box fc-dec" /><text x="34" y="31" className="fc-s">Decision point</text>
                <rect y="52" width="24" height="20" rx="5" className="fc-box fc-ok" /><text x="34" y="67" className="fc-s">Resolved on the call</text>
                <rect y="86" width="24" height="20" rx="5" className="fc-box fc-esc" /><text x="34" y="101" className="fc-s">Handled by a person</text>
                <rect y="120" width="24" height="20" rx="5" className="fc-box fc-out" /><text x="34" y="135" className="fc-s">What the lender sees</text>
              </g>
            </svg>
            <figcaption className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              Every call, whatever the outcome, ends in the same place: a saved transcript, an automatic review, and three screens for the lender.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="panel">
        <h2>The six steps</h2>
        <ol className="how-steps">
          <li><b>A payment bounces.</b> An EMI auto-debit fails and the borrower becomes overdue.</li>
          <li><b>Meera calls within minutes.</b> She confirms she has the right person before mentioning the loan.</li>
          <li><b>She resolves it on the call.</b> A promise to pay, a part payment (never below the lender's minimum), or one payment link.</li>
          <li><b>Anything unusual goes to a human.</b> Disputes, hardship and questions outside her facts become a ticket with a summary.</li>
          <li><b>Every call is reviewed automatically.</b> A summary, key data points and a check against the lender's rules, by code and AI, with human spot-checks.</li>
          <li><b>The lender sees the numbers.</b> Calls, Performance and Quality show what happened and whether the rules held.</li>
        </ol>
      </section>
    </div>
  );
}
