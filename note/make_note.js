const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, convertInchesToTwip, ExternalHyperlink,
} = require("docx");

const INK = "11243A";
const MUTED = "5B6B85";
const RULE = "C9D2E0";
const ACCENT = "1A4FD6";

const P = (children, opts = {}) => new Paragraph({ children, spacing: { after: 55, line: 225 }, ...opts });
const run = (text, o = {}) => new TextRun({ text, font: "Calibri", size: 17, color: INK, ...o });
const b = (text, o = {}) => run(text, { bold: true, ...o });

const link = (text, url) =>
  new ExternalHyperlink({ link: url, children: [new TextRun({ text, font: "Calibri", size: 16, color: ACCENT, underline: {} })] });
const WISPR = "https://notes.wisprflow.ai/shared/";

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
          children: [run("A Hindi voice agent for bounced EMIs that recommends who takes the borrower next: the AI or a person.", { size: 18, color: MUTED })],
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
        P([
          run("Three interviews at an Indian lender that runs collections in-house: ", { size: 16, color: MUTED }),
          link("a product lead", WISPR + "vOJs1Uq_6balt58qXI-NhptISXss1Ru_2IFtK3rlYhI"),
          run(", ", { size: 16, color: MUTED }),
          link("a collections analyst", WISPR + "n9w-XilXtBm9QImnmkkci38FG3EUC8UbCTJE-CUFnTE"),
          run(" and ", { size: 16, color: MUTED }),
          link("a data-science lead", WISPR + "7XFk1Q79FXjCwW-3QSH8rjpszFu2XLhz2fNNkYbO3-Q"),
          run(".", { size: 16, color: MUTED }),
        ]),
        bullet([b("A fixed pattern. "), run("Bounces drop into the CRM and each agent places 900–1,000 calls a day, repeating until a call ends well. A promise just books a callback. Good agents prioritise in Excel and follow up on WhatsApp, which is encouraged but not tracked.", { size: 16 })]),
        bullet([b("Intent is judged by gut. "), run("About 30% of non-payers have an intent problem and 70% a genuine one (medical, salary delay, family), but there is no fixed rule and it varies by agent and region. The record is a one-word tag.", { size: 16 })]),
        bullet([b("Quality is sampled. "), run("A quality team hears 10–20% of calls. An AI now scores all of them, and its call tags match the agents' about 80% of the time.", { size: 16 })]),
        bullet([b("The bot already works; the decision does not. "), run("AI calling cut cost from ₹11 to ₹3–4 a minute and matched humans in an A/B test. What is still unbuilt: choosing which borrower goes to a person, and using the last call to shape the next.", { size: 16 })]),

        H("The solution"),
        P([run("A platform that makes the collection call for you, reviews what happened on it, and then recommends the next step, so you can plan your next collections. It works in three layers.")]),
        bullet([b("1 · The calling bot. "), run("Calls the borrower within minutes, in Hindi and Hinglish, while the bounce is hours old. It asks why the EMI was missed, listens, and asks for a date and an amount. It follows the lender's rules: confirms who it is speaking to first, sends one payment link, and raises a ticket for anything it cannot promise.")]),
        bullet([b("2 · The call review bot. "), run("Reads every call after it ends and notes the reason for the miss, the borrower's mood and how firm the promise was, then checks the call against the lender's rules.")]),
        bullet([b("3 · The bot that recommends an action plan. "), run("Uses the call and the borrower's history to say who should call next, the AI or a person, then turns that into a plan for the cycle: how many calls, how much money, by when. A borrower with a firm promise but four bounces in six months, for example, goes to a person.")]),

        H("Key product and AI decisions"),
        bullet([b("The product ends in a plan, not a recommendation. "), run("A route for one borrower does not change collections. The Plan tab turns the routes into resource allocation for the cycle: how many AI calls, person calls and reminders, how much lands by day 1, 3 and 7, and where the gap to target sits (the agent, our callers, or where effort goes).")]),
        bullet([b("Two questions decide the route, and rules decide, not the model. "), run("Has intent shifted (four or more bounces in the window)? Did the AI let the borrower down on this call? Either yes sends the borrower to a person. The model only extracts facts (reason, promise, tone).")]),
        bullet([b("Hard rules and judgement rules, so every verdict can be explained. "), run("Hard rules (one link, no threat, nothing unapproved) are checked in code; judgement rules (listened first) are scored by a model against a quote from the call. AI suggested leaving all judgement to the model; I kept the split because a lender cannot audit a verdict it cannot explain.")]),

        H("Deliberately left out"),
        bullet([b("Pre-bounce awareness calling. "), run("That is about making the borrower aware in time, which an IVR call or a reminder already does. The talking happens after the bounce, and that is where capturing intent matters, so that is where we started.", { size: 16 })]),
        bullet([b("One collections playbook for every lender. "), run("Each bank or NBFC sets up its own agent, so the demo journey is a sample, not a standard. We provide the layer beneath any agent, better signals and the next step rather than another collections bot, so teams can build their own agent on it.", { size: 16 })]),

        H("Why Razorpay"),
        bullet([b("It already runs the mandate that bounced. "), run("A failed debit already fires a webhook, which is the trigger this needs, and the payment link and the measurement sit on the same rails. Razorpay would sell rupees recovered, not plumbing.")]),

        H("Success metric and what to test next"),
        METRICS,
        P([
          b("Next test: "),
          run("send half of one month's bounced EMIs through the agent and half through today's process, and compare rupees collected in nine days. Sample figures are synthetic; the weights are not yet tuned and the plan is shown, not executed.", { size: 15, color: MUTED }),
        ], { spacing: { before: 55 } }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/razorpay_buildathon/note/product-note.docx", buf);
  console.log("written");
});
