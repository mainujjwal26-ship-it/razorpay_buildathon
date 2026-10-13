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
    ["Claude Sonnet, via API", "Runs inside the product: drives each turn of the call, then reviews it and scores it against the rules", "Runtime"],
    ["Sarvam AI", "Hindi and Hinglish speech to text and text to speech on the live call", "Runtime"],
    ["Replit + GitHub", "Hosting and deployment; its agent worked the same repository", "Build-time"],
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
      "Set the decision design: rules decide the route, the model only extracts facts. Hard rules in code, judgement rules scored by the model, so every verdict can be explained. One persona with real history rather than six shallow ones.",
      "Built the decision engine and the tests that pin its thresholds, and implemented the hard and judgement rules as I specified them.",
    ],
    [
      "Specified the dashboard: which tabs exist, what each one answers, and who each is for. Decided the product must end in a plan, not a recommendation, and what the gap areas are: the agent, our callers, and where effort goes.",
      "Built the screens and the Plan tab, computed the metrics across a 100-call sample book, and rebuilt them when I changed the structure.",
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
            top: convertInchesToTwip(0.4),
            bottom: convertInchesToTwip(0.35),
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
          children: [run("Ujjwal Goel  ·  68 commits, 5–13 Oct 2026 (45 Claude Code, 13 Replit agent, 10 me)  ·  ~11,800 lines of TypeScript, 8,400 of rules and content, 37 tests  \u00b7  ", { size: 15, color: MUTED }), link("repository", REPO, 15)],
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

        H("How AI helped me 10x"),
        bullet([b("Breadth one person could not cover. "), run("A Hindi voice agent, a call review step, a decision engine, a six-tab dashboard and a planning tab, built in nine days: 68 commits, about 11,800 lines of code and 37 tests.")]),
        bullet([b("Research in hours. "), run("AI scored the candidate problems against my criteria and researched the market size, the bounce data and the RBI recovery directions.")]),
        bullet([b("A feedback loop that closed in minutes. "), run("Real call logs go to GitHub, Claude Code reads what happened, I edit a script line or a threshold, and the live app has it the same evening.")]),

        H("Key prompts, workflows and agent setup"),
        P([
          run("The product is three layers: "),
          b("the calling bot"),
          run(" that makes the call, "),
          b("the call review bot"),
          run(" that reads it afterwards, and "),
          b("the bot that recommends an action plan"),
          run(" from what the calls revealed. Between them sit written instructions, two prompts that return JSON, and a rule engine the model is not allowed to overrule. The instructions are all in the repository and can be read directly \u2014 these are the files that decide what the agent says and when it hands a borrower over."),
        ]),
        FILES,
        P([
          run("Two prompts do the work, and both return JSON rather than prose. The "),
          b("turn prompt"),
          run(" takes the call so far and returns what to say, what to speak aloud, which action to take (one payment link, raise a ticket, hand off) and whether to end the call. The "),
          b("review prompt"),
          run(" takes the finished transcript and returns the outcome, the reason, the root cause, the promise, the borrower\u2019s cooperation and a verdict on every rule. Structured output is what lets the rest of the system be ordinary, testable code \u2014 and it is why the model never picks the route."),
        ], { spacing: { before: 70, after: 55 } }),
        ...figure("agent.png", 460, 212, "The three layers: the call, the review of the call, and the plan. The rules, not the model, decide what happens next."),
        P([
          run("Reading it across: the borrower\u2019s audio goes to the server, which sends it to Sarvam for transcription, builds the turn prompt from the content files, and calls the Claude API for a structured turn; speech goes back out through Sarvam. Every event is written to Postgres and the call log is pushed to GitHub. When the call ends, the review prompt and the checks written in code score the same call independently, and a flag from either counts. Only then does the decision engine combine those facts with the borrower\u2019s history and pick a route. The third layer does not stop at one borrower: the Plan tab turns every route into a plan for the cycle \u2014 how many AI calls, person calls and reminders, how much money lands by day 1, 3 and 7, and whether the gap to target sits in the agent, in our callers or in where effort goes.", { size: 16 }),
        ]),
        P([
          run("The build loop mattered as much as the prompts. Claude was connected to GitHub, and GitHub to Replit, so a change was live in minutes. Call logs are pushed back into the same repository, so Claude Code could read what actually happened on a real call \u2014 what the borrower said, which rule tripped, where the agent stalled \u2014 instead of me listening to recordings and writing notes. Every change passed typecheck, build, 37 tests and a screenshot of the real screen before it was committed."),
        ]),
        ...figure("buildloop.png", 460, 129, "The build loop: a live call could change the agent the same evening."),
        H("One AI output I rejected, corrected or significantly improved"),
        P([
          b("The suggestion: let the model judge everything. "),
          run("When I specified how the agent\u2019s calls would be scored, the AI proposed the simplest design: give the model the transcript and let it judge every rule, hard and soft. It would have been less code and it read well in a demo."),
        ]),
        P([
          b("Why I rejected it. "),
          run("A lender cannot audit a verdict it cannot explain. If a model alone says a call broke a rule, nobody can show the regulator why, and nobody can tell whether the model or the agent was wrong. "),
          b("What I did instead. "),
          run("The hard rules (one payment link, no threat, nothing the lender has not approved) are checked in exact code. The judgement rules (did she listen first, did she handle the reason) are scored by the model, but each verdict must cite a quote from the call. A flag from either side counts as a breach. Every verdict can be traced to a line of code or a line of the transcript."),
        ]),
        P([
          run("Also rejected: a demo mode on its own interface. It now runs the real screens with canned data.", { size: 15, color: MUTED }),
        ]),

        H("What the AI did versus what I decided"),
        SPLIT,
        P([
          run("The honest summary: the AI was a computational assistant. It did the heavy lifting — code, computation, research, sample data — and sharpened what I knew by arguing with it. The problem, the collections process, the guardrails and what each screen answers came from my own time in this domain and the three interviews.", { size: 16 }),
        ], { spacing: { before: 60 } }),

        H("What I deliberately left out"),
        P([run("These were scoping decisions, not things the AI could not build. The reasons are in the product note.", { size: 16 })]),
        bullet([b("Pre-bounce awareness calling. "), run("Making a borrower aware in time can be done by an IVR call or a reminder. The talking, and the intent worth capturing, happens after the bounce, so that is where we started.")]),
        bullet([b("One playbook for every lender. "), run("Each bank or NBFC sets up its own agent, so the demo journey is a sample. The product is the layer beneath any agent: better signals and the next step, not just another collections bot.")]),

        H("Known limitations, risks and verification steps"),
        bullet([b("The numbers are synthetic. "), run("Every metric on the performance screens comes from a 100-call sample book, not from live borrowers. They show the measurement works, not that the agent works.")]),
        bullet([b("The weights are uncalibrated. "), run("Nothing yet records whether a promise was kept, so the confidence walk behind the decision has never been checked against a real outcome. Until it is, the thresholds are reasoned, not proven.")]),
        bullet([b("The plan is shown, not executed. "), run("The Plan tab says what to do this cycle, but nothing yet dials, hands a case over or sends a reminder, and the sample holds no results for person calls, so none are assumed.")]),
        bullet([b("The AI reviewer is untuned. "), run("The 29.7% hard-rule breach rate on sample calls is partly a strict reviewer and partly the agent being wrong; I cannot yet separate the two.")]),
        bullet([b("How it was verified. "), run("Rules are checked twice, by exact code and by the model, and a flag from either counts. 37 tests pin the thresholds and the metric arithmetic, and screens were checked by screenshot. Every figure in the note has a source or is labelled my own calculation, because the AI once wrote a statistic that was not in the data.")]),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(`${DIR}/ai-build-log.docx`, buf);
  console.log("written");
});
