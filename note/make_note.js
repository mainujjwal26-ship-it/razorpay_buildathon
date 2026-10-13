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
    ["EMI auto-debits that fail", "~29% of NACH debits by volume, 22% by value", "NPCI data (public series ends 2022)"],
    ["Still unpaid 31–180 days later", "2.3% of the book ≈ ₹39,000 crore; 5.7% for small-ticket NBFC loans", "CRIF Jun-26; rupee figure is my arithmetic"],
    ["What chasing it costs", "₹11 a minute of human calling; one caller covers ~400 borrowers", "Lender interviews"],
  ],
);

const METRICS = mkTable(
  [2450, 3550, 3240],
  [
    ["Metric", "What it tells the lender", "Demo build (sample of 100 EMIs)"],
    ["PRIMARY: payment collected", "Rupees recovered of rupees due", "46% · ₹2,30,000 of ₹5,00,000"],
    ["Resolution rate and time", "Bounced EMIs cleared in full, and how fast", "40 of 100 · 5 days median"],
    ["Hard-rule breach rate", "Compliance; the target is zero", "29.7% — the gap to close first"],
    ["Routing accuracy", "Handovers a reviewer agrees with", "Not yet measured; needs live calls"],
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
          children: [run("A Hindi voice agent for bounced personal-loan EMIs: it holds the call, then recommends whether the AI or a person takes the borrower next.", { size: 18, color: MUTED })],
          spacing: { after: 30 },
        }),
        new Paragraph({
          children: [run("Ujjwal Goel  ·  Build Challenge Track 2: Recover and Grow with AI  ·  13 October 2026", { size: 15, color: MUTED })],
          spacing: { after: 45 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 5 } },
        }),

        H("The problem"),
        P([
          b("For the head of collections at an NBFC: roughly one EMI auto-debit in three fails, and recovery is bought in headcount. "),
          b("One caller covers about 400 borrowers, so chasing more bounces means hiring more people. The decision that moves money, which borrower deserves which kind of effort, is made by feel."),
        ]),
        MARKET,

        H("What we heard, and how it is handled today"),
        P([run("Three interviews at an Indian lender that runs collections in-house: a product lead, a collections analyst and a data-science lead.", { size: 16, color: MUTED })]),
        bullet([b("A fixed pattern. "), run("Bounces drop into the CRM and each agent places 900–1,000 calls a day, repeating until a positive disposition. A promise just schedules a callback. Good agents prioritise in Excel and follow up on WhatsApp, which is encouraged but not tracked.", { size: 16 })]),
        bullet([b("Intent is judged by gut. "), run("About 30% of non-payers have an intent problem and 70% a genuine one (medical, salary delay, family), but there is no fixed rule and it varies by agent and region. The record is a one-word disposition.", { size: 16 })]),
        bullet([b("Quality is sampled. "), run("A quality team hears 10–20% of calls. An LLM now scores all of them, and its dispositions match the agents' about 80% of the time.", { size: 16 })]),
        bullet([b("The bot already works; the decision does not. "), run("AI calling cut cost from ₹11 to ₹3–4 a minute and matched humans in an A/B test. What is still unbuilt: choosing which borrower goes to a person, and using the last call to shape the next.", { size: 16 })]),

        H("The solution"),
        bullet([b("Calls within minutes, in Hindi and Hinglish. "), run("The Razorpay Trusted Collections Agent reaches the borrower while the bounce is hours old.")]),
        bullet([b("Negotiates like a good agent, inside the lender's rules. "), run("Identity first, asks why and listens, proposes a date that fits payday, one payment link, a ticket instead of a promise it cannot make.")]),
        bullet([b("Turns the call into signals and recommends the next step. "), run("Reason, tone and promise specificity plus the borrower's history give one route: keep the AI, or hand to a person. The demo borrower makes the point: a firm promise, yet four bounces in six months send him to a person.")]),

        H("Key product and AI decisions"),
        bullet([b("Two questions decide the route. "), run("Has intent shifted (four or more bounces in the window)? Did the AI let the borrower down on this call? Either yes sends the borrower to a person. Two questions fit on a screen and match how the lender's team described judging intent.")]),
        bullet([b("Rules route; the model never does. "), run("The model only extracts facts (reason, promise, tone). Fixed, readable rules decide, so every route can be explained and a threshold is a one-line edit in a content file.")]),
        bullet([b("Every call is checked twice. "), run("A model review plus exact checks in code; a flag from either counts as a breach. No waiver or unapproved promise is ever made; a ticket is raised instead.")]),

        H("Deliberately left out"),
        bullet([run("No approve-or-override workflow, so the manager sees the route and the reason, not another queue. No field-visit model: the sample never triggers it and I did not invent one. No channel or timing optimisation. No bureau or bank data: one call plus the lender's own history. India-only numbers, no global benchmarks.", { size: 16 })]),

        H("Why Razorpay"),
        bullet([b("It already runs the mandate that bounced. "), run("A failed debit already fires a webhook, which is the trigger this agent needs, and the payment link and the measurement land on the same rails.")]),
        bullet([b("It sells an outcome, not plumbing. "), run("Rupees recovered, priced against ₹11-a-minute human calling, under a regulated aggregator's recorded, rule-scored calls.")]),

        H("Success metric and what to test next"),
        METRICS,
        P([
          b("Next test: "),
          run("split one month's bounced EMIs, half through the agent and its routing and half through today's process, and compare rupees collected in nine days and whether routed-to-person cases recover more than if left with the AI. Sample figures are synthetic; weights are uncalibrated and the recommendation is shown, not executed.", { size: 15, color: MUTED }),
        ], { spacing: { before: 55 } }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/razorpay_buildathon/note/product-note.docx", buf);
  console.log("written");
});
