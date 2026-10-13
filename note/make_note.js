const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ShadingType, convertInchesToTwip,
} = require("docx");

const INK = "11243A";
const MUTED = "5B6B85";
const RULE = "C9D2E0";
const ACCENT = "1A4FD6";

const P = (children, opts = {}) => new Paragraph({ children, spacing: { after: 80, line: 250 }, ...opts });
const run = (text, o = {}) => new TextRun({ text, font: "Calibri", size: 19, color: INK, ...o });
const b = (text, o = {}) => run(text, { bold: true, ...o });

const H = (text) =>
  new Paragraph({
    children: [new TextRun({ text, font: "Calibri", size: 20, bold: true, color: ACCENT, allCaps: true, characterSpacing: 20 })],
    spacing: { before: 170, after: 70 },
  });

const bullet = (children) => new Paragraph({ children, bullet: { level: 0 }, spacing: { after: 50, line: 250 }, indent: { left: 200, hanging: 160 } });

// ---- metrics table ----
const COLS = [2520, 3700, 3020];
const cell = (children, o = {}) =>
  new TableCell({
    children,
    width: { size: o.w, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: o.head ? { type: ShadingType.CLEAR, fill: "EEF3FB", color: "auto" } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  });

const row = (cells, head = false) =>
  new TableRow({
    children: cells.map((text, i) =>
      cell([new Paragraph({ children: [run(text, { size: 17, bold: head, color: head ? INK : i === 1 ? MUTED : INK })], spacing: { after: 0, line: 230 } })], {
        w: COLS[i],
        head,
      }),
    ),
    tableHeader: head,
  });

const metrics = new Table({
  columnWidths: COLS,
  width: { size: COLS.reduce((a, c) => a + c, 0), type: WidthType.DXA },
  rows: [
    row(["Metric", "What it tells the lender", "Demo build (sample)"], true),
    row(["Payment collected", "Rupees recovered of rupees targeted", "46%  ·  ₹2,30,000 of ₹5,00,000"]),
    row(["Resolution rate", "Bounced EMIs cleared in full", "40 of 100 EMIs"]),
    row(["Resolution time", "Days from first call to full payment", "5 days (median)"]),
    row(["Promise-to-pay rate", "Calls ending in a dated, costed promise", "63.9% of conversations"]),
    row(["Clear reason captured", "Calls that explain why the EMI missed", "92.8% of conversations"]),
    row(["Hard-rule breach rate", "Compliance; target is zero", "29.7% — the gap to close first"]),
    row(["Cost per contact", "Cost of reaching one borrower", "₹10.50 AI vs ₹55 a person"]),
  ],
});

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 19, color: INK } } } },
  sections: [
    {
      properties: {
        page: {
          margin: { top: convertInchesToTwip(0.55), bottom: convertInchesToTwip(0.5), left: convertInchesToTwip(0.65), right: convertInchesToTwip(0.65) },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "Razorpay Trusted Collections Agent", font: "Calibri", size: 32, bold: true, color: INK })],
          spacing: { after: 30 },
        }),
        new Paragraph({
          children: [run("A Hindi voice agent that calls the moment an EMI bounces, and decides who should handle the borrower next.", { size: 20, color: MUTED })],
          spacing: { after: 40 },
        }),
        new Paragraph({
          children: [run("Ujjwal Goel  ·  Build Challenge Track 2: Recover and Grow with AI  ·  13 October 2026", { size: 17, color: MUTED })],
          spacing: { after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
        }),

        H("The problem"),
        P([
          run("India holds ₹170 lakh crore of retail loans, and about 2.4% of personal loans sit 31–180 days overdue — roughly ₹40,000 crore (CRIF High Mark, Mar 2026; rupee figure is my arithmetic). Lenders chase it with people, and the economics do not scale: one lender runs ~400 borrowers per calling agent at 900–1,000 dials a day and ₹11 a minute, with NBFC attrition reported near 77% a year."),
        ]),
        P([run("Three things break, and only the third is a decision problem:", { color: MUTED })]),
        bullet([b("The call is weak. "), run("The agent speaks without the borrower's history, and quality varies: only 10–20% of calls are ever reviewed.")]),
        bullet([b("The record is weak. "), run("The reason for the miss becomes a one-word disposition, and nobody tracks whether a promise was kept.")]),
        bullet([b("Nobody decides who deserves which effort. "), run("A borrower whose intent is sliding and one who simply got paid late receive the same callback, so cost goes to the wrong people.")]),

        H("The solution"),
        P([
          run("Meera calls within minutes of the bounce, in Hindi and Hinglish. In the call she confirms identity before mentioning the loan, states only the lender's facts, asks for a promise with a date "),
          run("and", { italics: true }),
          run(" an amount, sends exactly one payment link, and raises a ticket for anything outside her authority — she never promises a waiver. After the call, the conversation becomes structured data: reason, root cause, promise, cooperation, tickets, plus a transcript scored against every rule."),
        ]),

        H("The decision it makes"),
        P([run("Two readable questions, answered by rules, not by the model:", { color: MUTED })]),
        bullet([b("1. Has the borrower's intent shifted toward not paying? "), run("From the EMI history alone: four or more of the last six EMIs bounced, or past promises mostly broken.")]),
        bullet([b("2. Did the borrower let the AI down on this call? "), run("No firm date and amount, or an evasive or hostile conversation.")]),
        P([
          run("Either answer Yes routes the borrower to a person; both No keeps them with the AI. The model extracts facts; the rules decide, so every recommendation can be read back to a compliance officer. The demo borrower makes the point: he gives a firm promise that fits his payday, yet four bounces in six months send him to a person "),
          run("before", { italics: true }),
          run(" he breaks another promise. A CRM would have booked a callback."),
        ]),

        H("Success metrics"),
        metrics,
        P([run("Sample figures from a demo book of 100 bounced EMIs of ₹5,000. Call costs are from a collections analyst at an Indian lender.", { size: 16, color: MUTED })], { spacing: { before: 60, after: 40 } }),

        H("Control and trust"),
        bullet([b("Every call is scored, not sampled. "), run("Hard rules (identity first, no false promise, no threats, facts only, one link) and judgement rules (listened first, clean close) run on 100% of calls, against the 10–20% a quality team can sample by hand.")]),
        bullet([b("The reviewer sees the reasoning, not a score. "), run("The transcript, the extracted facts and the two answers that produced the recommendation sit on one screen.")]),
        bullet([b("What stays human. "), run("Disputes, hardship, anything outside Meera's authority, and every borrower whose intent has shifted — by design, not by exception.")]),

        H("Known gaps"),
        P([
          run("The recommendation is shown, not yet executed — no handoff packet or pause control is built. Weights are uncalibrated: nothing yet records whether a promise was kept, so there is no learning loop. And the 29.7% hard-rule breach rate on sample calls is the first thing to fix before any pilot.", { size: 17 }),
        ]),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/razorpay_buildathon/note/product-note.docx", buf);
  console.log("written");
});
