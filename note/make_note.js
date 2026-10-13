const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, convertInchesToTwip,
} = require("docx");

const INK = "11243A";
const MUTED = "5B6B85";
const RULE = "C9D2E0";
const ACCENT = "1A4FD6";

const P = (children, opts = {}) => new Paragraph({ children, spacing: { after: 55, line: 225 }, ...opts });
const run = (text, o = {}) => new TextRun({ text, font: "Calibri", size: 17, color: INK, ...o });
const b = (text, o = {}) => run(text, { bold: true, ...o });

const H = (text) =>
  new Paragraph({
    children: [new TextRun({ text, font: "Calibri", size: 18, bold: true, color: ACCENT, allCaps: true, characterSpacing: 20 })],
    spacing: { before: 105, after: 45 },
  });

const bullet = (children) =>
  new Paragraph({ children, bullet: { level: 0 }, spacing: { after: 32, line: 225 }, indent: { left: 190, hanging: 150 } });

const mkTable = (cols, rows) => {
  const cell = (text, i, head) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [run(text, { size: 15, bold: head, color: head ? INK : i === 0 ? INK : MUTED })],
          spacing: { after: 0, line: 205 },
        }),
      ],
      width: { size: cols[i], type: WidthType.DXA },
      margins: { top: 40, bottom: 40, left: 85, right: 85 },
      shading: head ? { type: ShadingType.CLEAR, fill: "EEF3FB", color: "auto" } : undefined,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
    });
  return new Table({
    columnWidths: cols,
    width: { size: cols.reduce((a, c) => a + c, 0), type: WidthType.DXA },
    rows: rows.map((r, ri) => new TableRow({ children: r.map((t, i) => cell(t, i, ri === 0)), tableHeader: ri === 0 })),
  });
};

const MARKET = mkTable(
  [2750, 4100, 2390],
  [
    ["India's personal loan market", "Figure", "Source"],
    ["Loans outstanding", "₹17.0 lakh crore across 12.7 crore live loans (Jun 2026)", "CRIF High Mark"],
    ["Typical ticket", "₹61,112 on average, but ₹18,802 at digital NBFCs, who write 70% of sanctions by volume", "CRIF High Mark; FACE"],
    ["EMI auto-debits that fail", "~29% of NACH debits by volume, 22% by value", "NPCI data (public series ends 2022)"],
    ["Still unpaid 31–180 days later", "2.3% of the book ≈ ₹39,000 crore; 5.7% for small-ticket NBFC loans", "CRIF Jun-26; rupee figure is my arithmetic"],
    ["What chasing it costs", "₹11 a minute of human calling, and one caller covers ~400 borrowers", "Lender interview"],
  ],
);

const METRICS = mkTable(
  [2450, 3550, 3240],
  [
    ["Metric", "What it tells the lender", "Demo build (sample of 100 EMIs)"],
    ["Payment collected", "Rupees recovered of rupees targeted", "46% · ₹2,30,000 of ₹5,00,000"],
    ["Resolution rate and time", "Bounced EMIs cleared in full, and how fast", "40 of 100 EMIs · 5 days median"],
    ["Promise and reason capture", "Calls ending in a dated promise, and in a clear reason", "63.9% and 92.8% of conversations"],
    ["Routing accuracy", "Handovers a reviewer agrees with", "Not yet measured — needs live calls"],
    ["Hard-rule breach rate", "Compliance; the target is zero", "29.7% — the gap to close first"],
    ["Cost per contact", "Cost of reaching one borrower", "₹10.50 by AI vs ₹55 by a person"],
  ],
);

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 17, color: INK } } } },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.45),
            bottom: convertInchesToTwip(0.4),
            left: convertInchesToTwip(0.6),
            right: convertInchesToTwip(0.6),
          },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "Razorpay Trusted Collections Agent", font: "Calibri", size: 30, bold: true, color: INK })],
          spacing: { after: 25 },
        }),
        new Paragraph({
          children: [run("A Hindi voice agent for bounced personal-loan EMIs: it holds the call, then decides whether the AI, a person or the field team takes the borrower next.", { size: 18, color: MUTED })],
          spacing: { after: 30 },
        }),
        new Paragraph({
          children: [run("Ujjwal Goel  ·  Build Challenge Track 2: Recover and Grow with AI  ·  13 October 2026", { size: 15, color: MUTED })],
          spacing: { after: 45 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 5 } },
        }),

        H("The problem"),
        P([
          b("India's personal-loan book is 12.7 crore live loans, most of them small-ticket, and roughly one EMI auto-debit in three fails. "),
          b("Recovery is then bought in headcount — one caller covers about 400 borrowers — so chasing more bounces means hiring more people, each calling without the borrower's history and logging a one-word reason. "),
          b("The decision that actually moves money, which borrower deserves which kind of effort, is never made at all."),
        ]),
        MARKET,

        new Paragraph({ children: [run("Four reasons it stays uncollected:", { color: MUTED, size: 16 })], spacing: { before: 65, after: 38 } }),
        bullet([b("Calling capacity cannot scale. "), run("More book means more agents, each needing training and a ramp, against NBFC attrition reported near 77% a year. Cost per rupee recovered rises exactly when the book grows.", { size: 16 })]),
        bullet([b("Agent quality varies, and incentives make it worse. "), run("It varies between agents and within one agent across a shift. Only 10–20% of calls are reviewed, and agents are paid on promises logged rather than promises kept, so a soft promise counts the same as a real one.", { size: 16 })]),
        bullet([b("The record captures fields, not signals. "), run("An agent marks a disposition and a date. Tone, how firmly the borrower committed and the words they chose — the things that predict whether a promise holds — are never written down, so nothing can learn from them.", { size: 16 })]),
        bullet([b("The signals that do exist sit in separate systems. "), run("Communication behaviour, call history and the credit profile live in different tools. Few lenders triangulate them into one view of intent and one next step.", { size: 16 })]),

        H("The solution"),
        bullet([b("Calls within minutes, in Hindi and Hinglish. "), run("The Razorpay Trusted Collections Agent reaches the borrower while the bounce is hours old, not days.")]),
        bullet([b("Negotiates like a good agent. "), run("Asks why the EMI missed and listens, then proposes a date that fits when the borrower is actually paid, and asks for a promise with a date and an amount.")]),
        bullet([b("Stays inside the lender's rules. "), run("Identity first, the lender's facts only, exactly one payment link, and a ticket instead of a promise it has no authority to make, such as waiving a charge.")]),
        bullet([b("Turns the call into signals. "), run("Reason, root cause, tone, cooperation and promise specificity — on every call, with the transcript scored against every rule.")]),
        bullet([b("Recommends the next step. "), run("Call signals plus the borrower's history produce one route: keep dialling with the AI, hand to a human agent, or move to field collection. Rules decide and can be read aloud; the model only extracts facts. The demo borrower proves it — a firm promise, yet four bounces in six months hand him to a person before he breaks another.")]),

        H("Why this fits Razorpay"),
        bullet([b("Razorpay already runs the mandate that bounced. "), run("e-NACH and UPI Autopay for NBFCs sit behind one Razorpay API, and a failed debit already fires a webhook — the exact trigger this agent needs. No new integration to know who to call, or when.")]),
        bullet([b("The bounce and the cure live on the same rails. "), run("The link the agent sends is a Razorpay link, so the money and the measurement land in one place.")]),
        bullet([b("It turns a payments product into an outcome. "), run("Lenders buy mandate infrastructure today; this sells rupees recovered on the same plumbing, priced against ₹11-a-minute human calling.")]),
        bullet([b("Compliance and scale both favour the aggregator. "), run("An RBI-authorised payment aggregator is better placed than a point vendor to run recorded, rule-scored calls under the RBI recovery directions of August 2026 — and bounce outcomes seen across many lenders calibrate the routing better than any single book can.")]),

        H("Success metrics"),
        METRICS,
        P([
          run("Not yet built: the recommendation is shown but not executed, weights are uncalibrated because nothing records whether a promise was kept, and the demo routes between AI and a person only.", { size: 15, color: MUTED }),
        ], { spacing: { before: 55 } }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/razorpay_buildathon/note/product-note.docx", buf);
  console.log("written");
});
