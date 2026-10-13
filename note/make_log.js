const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, ImageRun, AlignmentType, ExternalHyperlink, convertInchesToTwip,
} = require("docx");

const REPO = "https://github.com/mainujjwal26-ship-it/razorpay_buildathon";
const BLOB = `${REPO}/blob/main`;

const INK = "11243A";
const MUTED = "5B6B85";
const RULE = "C9D2E0";
const ACCENT = "1A4FD6";
const DIR = "/home/claude/razorpay_buildathon/note";

const P = (children, opts = {}) => new Paragraph({ children, spacing: { after: 55, line: 225 }, ...opts });
const run = (text, o = {}) => new TextRun({ text, font: "Calibri", size: 17, color: INK, ...o });
const b = (text, o = {}) => run(text, { bold: true, ...o });

const H = (text) =>
  new Paragraph({
    children: [new TextRun({ text, font: "Calibri", size: 18, bold: true, color: ACCENT, allCaps: true, characterSpacing: 20 })],
    spacing: { before: 150, after: 50 },
  });

const bullet = (children) =>
  new Paragraph({ children, bullet: { level: 0 }, spacing: { after: 32, line: 225 }, indent: { left: 190, hanging: 150 } });

/** A clickable file path. */
const link = (text, href, size = 17) =>
  new ExternalHyperlink({
    children: [new TextRun({ text, font: "Calibri", size, color: "1A4FD6", underline: {}, bold: true })],
    link: href,
  });

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

/** A rendered diagram, full text width. */
const figure = (file, w, h, caption) => [
  new Paragraph({
    children: [new ImageRun({ type: "png", data: fs.readFileSync(`${DIR}/${file}`), transformation: { width: w, height: h } })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 70, after: 30 },
  }),
  new Paragraph({
    children: [run(caption, { size: 15, color: MUTED, italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 90 },
  }),
];

const TOOLS = mkTable(
  [2250, 4250, 2740],
  [
    ["Tool or model", "What it was used for", "Build-time or runtime"],
    ["Claude Code (Opus and Sonnet)", "Wrote the application code, the tests, the sample book and the rule harness; ran the research sweeps", "Build-time"],
    ["Claude Sonnet, via API", "Runs inside the product: drives each turn of the live call, then reviews the finished call and scores it against the rules (LLM_MODEL, LLM_REVIEW_MODEL)", "Runtime"],
    ["Sarvam AI", "Hindi and Hinglish speech to text and text to speech on the live call", "Runtime"],
    ["Replit + GitHub", "Hosting and deployment, with its agent working the same repository in parallel", "Build-time"],
    ["Wispr Flow", "Transcribed and summarised the three lender interviews", "Build-time"],
  ],
);

const SPLIT = mkTable(
  [4620, 4620],
  [
    ["What I decided and defined", "What the AI did"],
    [
      "Chose the problem: brainstormed broadly, then set my own selection criteria and stress-tested each candidate against them before committing to post-bounce collections.",
      "Scored the candidates against my criteria, argued the weak ones down, and researched the market size, the bounce data and the RBI recovery directions.",
    ],
    [
      "Defined the collections process itself — buckets, the post-bounce workflow, what a good agent does — from my own years in the domain, then corrected it against three lender interviews I ran.",
      "Turned that process into a working call flow, state machine and data model, and transcribed and summarised the interviews.",
    ],
    [
      "Wrote the inputs that govern behaviour: the guardrails, the rule checks that count as a breach, the tonality and the call script.",
      "Implemented each rule twice — as exact code and as an AI reviewer — so a flag from either counts, and built the harness that scores every call.",
    ],
    [
      "Set the decision design: rules decide the route, the model only extracts facts. One persona with real history rather than six shallow ones.",
      "Built the decision engine, the confidence walk behind it, and 12 tests that pin the thresholds.",
    ],
    [
      "Specified the dashboard: which tabs exist, what each one answers, and which metrics matter enough to be shown large.",
      "Built the screens, computed the metrics across a 100-call sample book, and rebuilt them when I changed the structure.",
    ],
    [
      "Judged every output: what shipped, what was cut, and what was wrong.",
      "Produced far more than shipped, which is what made cutting cheap.",
    ],
  ],
);

const FILE_ROWS = [
  ["content/prompts/agent.md", "How Meera speaks: her role, her limits, and the JSON she must return"],
  ["content/script.md", "The call itself: opening, identity check, how to ask for a promise, how to close"],
  ["content/policy.json", "What she may offer: minimum part payment, link rules, calling hours"],
  ["content/guardrails.json", "The never-do rules: no false promise, no threat, lender facts only"],
  ["content/review-checks.json", "What the reviewer scores after the call, hard rules and judgement rules"],
  ["content/decision-rules.json", "The thresholds that route a borrower: bounces, promises kept, cooperation"],
  ["content/customers/history.json", "The borrower history the decision reads: EMIs, promises, calls answered"],
];

const fcell = (children, w) =>
  new TableCell({
    children: [new Paragraph({ children, spacing: { after: 0, line: 205 } })],
    width: { size: w, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 85, right: 85 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  });

/** The files that govern the agent, each one clickable. */
const FILES = new Table({
  columnWidths: [3400, 5840],
  width: { size: 9240, type: WidthType.DXA },
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ children: [run("File (click to open on GitHub)", { size: 15, bold: true })], spacing: { after: 0, line: 205 } })],
          width: { size: 3400, type: WidthType.DXA },
          margins: { top: 40, bottom: 40, left: 85, right: 85 },
          shading: { type: ShadingType.CLEAR, fill: "EEF3FB", color: "auto" },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: RULE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [run("What it governs", { size: 15, bold: true })], spacing: { after: 0, line: 205 } })],
          width: { size: 5840, type: WidthType.DXA },
          margins: { top: 40, bottom: 40, left: 85, right: 85 },
          shading: { type: ShadingType.CLEAR, fill: "EEF3FB", color: "auto" },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: RULE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        }),
      ],
    }),
    ...FILE_ROWS.map(([path, what]) =>
      new TableRow({
        children: [fcell([link(path, `${BLOB}/${path}`, 15)], 3400), fcell([run(what, { size: 15, color: MUTED })], 5840)],
      }),
    ),
  ],
});

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 17, color: INK } } } },
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
          children: [new TextRun({ text: "AI build log", font: "Calibri", size: 30, bold: true, color: INK })],
          spacing: { after: 25 },
        }),
        new Paragraph({
          children: [run("Razorpay Trusted Collections Agent — how the build was done, what the AI did, and where I made the calls.", { size: 18, color: MUTED })],
          spacing: { after: 30 },
        }),
        new Paragraph({
          children: [run("Ujjwal Goel  ·  55 commits, 5–13 October 2026  ·  ~5,000 lines of application code, 8,400 lines of rules and content, 37 tests  \u00b7  ", { size: 15, color: MUTED }), link("repository", REPO, 15)],
          spacing: { after: 45 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 5 } },
        }),

        H("AI tools and models used"),
        TOOLS,
        P([
          run("The distinction that matters: one set of tools ", { size: 16 }),
          run("built", { italics: true, size: 16 }),
          run(" the product, and a different set ", { size: 16 }),
          run("runs inside", { italics: true, size: 16 }),
          run(" it. The agent a borrower speaks to is a Claude model with Sarvam speech on either side; the thing that wrote it is Claude Code.", { size: 16 }),
        ], { spacing: { before: 60, after: 40 } }),

        H("Key prompts, workflows and agent setup"),
        P([
          run("The agent is three things: a set of written instructions, two prompts that return JSON, and a rule engine the model is not allowed to overrule. The first part is all in the repository and can be read directly \u2014 these are the files that decide what the agent says and when it hands a borrower over."),
        ]),
        FILES,
        P([
          run("Two prompts do the work, and both return JSON rather than prose. The "),
          b("turn prompt"),
          run(" takes the call so far and returns what to say, what to speak aloud, which action to take (one payment link, raise a ticket, hand off) and whether to end the call. The "),
          b("review prompt"),
          run(" takes the finished transcript and returns the outcome, the reason, the root cause, the promise, the borrower\u2019s cooperation and a verdict on every rule. Structured output is what lets the rest of the system be ordinary, testable code \u2014 and it is why the model never picks the route."),
        ], { spacing: { before: 70, after: 55 } }),
        ...figure("agent.png", 500, 230, "The system: speech and reasoning are separate services, and the rules, not the model, decide what happens next."),
        P([
          run("Reading it across: the borrower\u2019s audio goes to the server, which sends it to Sarvam for transcription, builds the turn prompt from the content files, and calls the Claude API \u2014 which returns a structured turn rather than free text. Speech goes back out through Sarvam. Every event is written to Postgres as it happens, and the whole call log is pushed to a branch on GitHub. When the call ends, the review prompt and the checks written in code score the same call independently, and a flag from either counts. Only then does the decision engine combine those facts with the borrower\u2019s history and pick a route.", { size: 16 }),
        ]),
        P([
          run("The build loop mattered as much as the prompts. Claude was connected to GitHub, and GitHub to Replit, so a change was live in minutes and I could watch it. More usefully, those call logs are pushed back into the same repository, so Claude Code could read what actually happened on a real call \u2014 what the borrower said, which rule tripped, where the agent stalled \u2014 and I could act on it immediately instead of listening to recordings and writing notes by hand."),
        ]),
        ...figure("buildloop.png", 500, 140, "The build loop: a live call could change the agent the same evening."),
        P([
          run("Every change ran the same gate before it was committed: typecheck, build, 37 tests, then a screenshot of the actual screen that the AI had to look at before claiming it worked. The decision engine deliberately has no runtime imports so its tests run standalone.", { size: 16 }),
        ]),

        H("One AI output I rejected, corrected or significantly improved"),
        P([
          run("[ To be completed ]", { color: ACCENT, bold: true }),
        ]),
        P([
          run("Candidates under consideration: the demo mode built on a separate interface, rejected because a demo on different screens proves nothing about the product; the fabricated statistic caught during review; the six-persona signal model cut down to one borrower with real history.", { size: 15, color: MUTED, italics: true }),
        ]),

        H("What the AI did versus what I decided"),
        SPLIT,
        P([
          run("The honest summary: the AI was a computational assistant. It did the heavy lifting — code, computation, research, sample data — and it sharpened what I already knew by arguing with it. It did not choose the problem, define the collections process, write the guardrails or decide what the dashboard should answer. Those came from my own time in this domain and from the three interviews.", { size: 16 }),
        ], { spacing: { before: 60 } }),

        H("Known limitations, risks and verification steps"),
        bullet([b("The numbers are synthetic. "), run("Every metric on the performance screens comes from a 100-call sample book, not from live borrowers. They show the measurement works, not that the agent works.")]),
        bullet([b("The weights are uncalibrated. "), run("Nothing yet records whether a promise was kept, so the confidence walk behind the decision has never been checked against a real outcome. Until it is, the thresholds are reasoned, not proven.")]),
        bullet([b("The AI reviewer is untuned. "), run("The 29.7% hard-rule breach rate on sample calls is partly the reviewer being strict and partly the agent being wrong, and I cannot yet separate the two.")]),
        bullet([b("How it was verified. "), run("Rules are checked twice, by exact code and by the model, and a flag from either counts. 37 automated tests pin the decision thresholds and the metric arithmetic. Screens were checked by screenshot, not by assertion. Every figure in the product note carries a source and a confidence level, and the figures I calculated myself are labelled as mine.")]),
        bullet([b("Where I had to verify the AI directly. "), run("It produced a statistic that was not in the data. It is the reason every number in these documents was traced back to either a source or a computation before it shipped.")]),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(`${DIR}/ai-build-log.docx`, buf);
  console.log("written");
});
