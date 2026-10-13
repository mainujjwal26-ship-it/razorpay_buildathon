const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, convertInchesToTwip,
} = require("docx");

const INK = "11243A";
const MUTED = "5B6B85";
const RULE = "C9D2E0";
const ACCENT = "1A4FD6";

const P = (children, opts = {}) => new Paragraph({ children, spacing: { after: 70, line: 240 }, ...opts });
const run = (text, o = {}) => new TextRun({ text, font: "Calibri", size: 18, color: INK, ...o });
const b = (text, o = {}) => run(text, { bold: true, ...o });

const H = (text) =>
  new Paragraph({
    children: [new TextRun({ text, font: "Calibri", size: 19, bold: true, color: ACCENT, allCaps: true, characterSpacing: 20 })],
    spacing: { before: 150, after: 60 },
  });

const bullet = (children) =>
  new Paragraph({ children, bullet: { level: 0 }, spacing: { after: 45, line: 240 }, indent: { left: 200, hanging: 160 } });

// ---- generic compact table ----
const mkTable = (cols, rows, headRow = true) => {
  const cell = (text, i, head) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [run(text, { size: 16, bold: head, color: head ? INK : i === 0 ? INK : MUTED })],
          spacing: { after: 0, line: 220 },
        }),
      ],
      width: { size: cols[i], type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
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
    rows: rows.map((r, ri) => new TableRow({ children: r.map((t, i) => cell(t, i, headRow && ri === 0)), tableHeader: headRow && ri === 0 })),
  });
};

const SCALE = mkTable(
  [3450, 3450, 2340],
  [
    ["Where the money is", "Figure", "Source"],
    ["Retail loans outstanding in India", "₹170.2 lakh crore, up 16.6% YoY", "CRIF High Mark, Mar 2026"],
    ["The unsecured book this agent serves", "₹16.5 lakh crore of personal loans, 12.2 crore live loans", "CRIF High Mark"],
    ["EMIs that bounce on auto-debit", "29.6% of NACH debits by volume; ~20% of e-mandate EMIs at one lender", "NPCI data; lender interview"],
    ["Still unpaid 31–180 days later", "2.4% of the personal-loan book ≈ ₹40,000 crore", "CRIF %; rupee figure is my arithmetic"],
    ["What chasing it costs", "₹11 a minute of human calling; ~400 borrowers per caller, so a 1 lakh bounce book needs ~250 callers", "Lender interview; headcount is my arithmetic"],
  ],
);

const METRICS = mkTable(
  [2450, 3550, 3240],
  [
    ["Metric", "What it tells the lender", "Demo build (sample of 100 EMIs)"],
    ["Payment collected", "Rupees recovered of rupees targeted", "46% · ₹2,30,000 of ₹5,00,000"],
    ["Resolution rate and time", "Bounced EMIs cleared in full, and how fast", "40 of 100 EMIs · 5 days median"],
    ["Promise-to-pay rate", "Calls ending in a dated, costed promise", "63.9% of conversations"],
    ["Clear reason captured", "Calls that explain why the EMI missed", "92.8% of conversations"],
    ["Routing accuracy", "Share of handovers a reviewer agrees with", "Not yet measured — needs live calls"],
    ["Hard-rule breach rate", "Compliance; the target is zero", "29.7% — the gap to close first"],
    ["Cost per contact", "Cost of reaching one borrower", "₹10.50 by AI vs ₹55 by a person"],
  ],
);

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 18, color: INK } } } },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.5),
            bottom: convertInchesToTwip(0.45),
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
          children: [run("A Hindi voice agent that calls the moment an EMI bounces, and decides whether the AI, a person or the field team should take the borrower next.", { size: 19, color: MUTED })],
          spacing: { after: 35 },
        }),
        new Paragraph({
          children: [run("Ujjwal Goel  ·  Build Challenge Track 2: Recover and Grow with AI  ·  13 October 2026", { size: 16, color: MUTED })],
          spacing: { after: 50 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 5 } },
        }),

        H("The problem: a large bounce book chased by a headcount that cannot grow with it"),
        SCALE,

        new Paragraph({ children: [run("Four reasons the money stays uncollected:", { color: MUTED, size: 17 })], spacing: { before: 90, after: 50 } }),
        bullet([b("Calling capacity cannot scale. "), run("Recovery is bought in headcount: more book means more agents, each needing training and a ramp, against NBFC attrition reported near 77% a year. Cost per rupee recovered rises exactly when the book grows.")]),
        bullet([b("Agent quality varies, and incentives make it worse. "), run("It varies between agents and within the same agent across a shift or a month. Only 10–20% of calls are ever reviewed, and agents are paid on promises logged rather than promises kept, so a soft promise counts the same as a real one.")]),
        bullet([b("The record captures fields, not signals. "), run("An agent marks a disposition and a date. Tone, how firmly the borrower committed, and the words they chose — the things that actually predict whether a promise holds — are never written down, so they cannot be learned from.")]),
        bullet([b("The signals that exist sit in separate systems. "), run("Communication behaviour, call history and the credit profile live in different tools. Few lenders triangulate them into one view of a borrower's intent and a single next step.")]),

        H("The solution"),
        P([
          run("Meera calls within minutes of the bounce, in Hindi and Hinglish, and holds a real conversation: she confirms identity before mentioning the loan, asks why the EMI missed and listens to the answer, negotiates a date that fits when the borrower is actually paid, and asks for a promise with a date "),
          run("and", { italics: true }),
          run(" an amount. She states only the lender's facts, sends exactly one payment link, and raises a ticket rather than promising anything she has no authority over, such as waiving a charge."),
        ]),
        P([
          run("Every call then becomes structured data — reason, root cause, promise, cooperation, tone, tickets, and a transcript scored against every rule — and is combined with the borrower's own history to produce one recommendation: "),
          b("keep dialling with the AI"),
          run(", "),
          b("hand to a human agent"),
          run(", or "),
          b("move to field collection"),
          run(". The rules decide and are readable: intent has shifted when four or more of the last six EMIs bounced or past promises were mostly broken; the AI was let down when there is no firm date and amount or the borrower was evasive; the field team takes over when the borrower has stopped answering calls altogether. The model extracts the facts; it never picks the route."),
        ]),
        P([
          run("The demo borrower makes the point. He gives a firm promise that fits his payday, so the call alone says book a callback — but four bounces in six months hand him to a person ", { size: 17 }),
          run("before", { italics: true, size: 17 }),
          run(" he breaks another promise. That is the decision a CRM cannot make.", { size: 17 }),
        ]),

        H("Success metrics"),
        METRICS,

        H("Known gaps"),
        P([
          run("The recommendation is shown but not yet executed: no handoff packet, override or pause control is built, and the demo routes between AI and a person because the field rule needs unreachable-borrower history the sample does not have. Weights are uncalibrated — nothing records yet whether a promise was kept, so there is no learning loop. The 29.7% hard-rule breach rate on sample calls is the first thing to fix before any pilot.", { size: 17 }),
        ]),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/razorpay_buildathon/note/product-note.docx", buf);
  console.log("written");
});
