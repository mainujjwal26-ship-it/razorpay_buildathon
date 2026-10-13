"""Draws the diagrams for the AI build log as SVG, then renders them to PNG.

Kept as source so a change is a text edit, not a redraw.
"""
import subprocess, pathlib, html

HERE = pathlib.Path(__file__).parent
SOFFICE = "/root/.claude/skills/synced/801d8ccb-1c70-4f95-8137-fe7de82ad180_05499cb4-cba3-4854-b6bf-6f32bdab3162/docx/scripts/office/soffice.py"
INK, MUTED, RULE, ACCENT, SOFT = "#11243A", "#5B6B85", "#C9D2E0", "#1A4FD6", "#EEF3FB"
FONT = "DejaVu Sans, Helvetica, Arial, sans-serif"


def esc(t):
    return html.escape(t)


def box(x, y, w, h, title, lines=(), fill="#FFFFFF", stroke=RULE, tcol=INK, ts=18, ls=14, dash=None, top=False):
    d = ' stroke-dasharray="7 5"' if dash else ""
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"{d}/>']
    ty = y + ts + 12 if top else y + (h - (len(lines) * (ls + 5) + ts)) / 2 + ts
    out.append(f'<text x="{x + w/2}" y="{ty}" text-anchor="middle" font-family="{FONT}" font-size="{ts}" font-weight="bold" fill="{tcol}">{esc(title)}</text>')
    for i, l in enumerate(lines):
        out.append(f'<text x="{x + w/2}" y="{ty + 7 + (i + 1) * (ls + 5)}" text-anchor="middle" font-family="{FONT}" font-size="{ls}" fill="{MUTED}">{esc(l)}</text>')
    return "".join(out)


def arrow(x1, y1, x2, y2, dash=False, label=None, col=None, lx=None, ly=None):
    c = col or "#7A8699"
    d = ' stroke-dasharray="6 5"' if dash else ""
    s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2.2" marker-end="url(#a)"{d}/>'
    if label:
        mx = lx if lx is not None else (x1 + x2) / 2
        my = ly if ly is not None else (y1 + y2) / 2 - 8
        s += f'<text x="{mx}" y="{my}" text-anchor="middle" font-family="{FONT}" font-size="13" fill="{MUTED}">{esc(label)}</text>'
    return s


def svg(w, h, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="#7A8699"/></marker></defs>'
        f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>{body}</svg>'
    )


def label(x, y, t, size=14, col=MUTED, anchor="start", bold=False, caps=False):
    wt = ' font-weight="bold"' if bold else ""
    ls = ' letter-spacing="1.4"' if caps else ""
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{FONT}" font-size="{size}" fill="{col}"{wt}{ls}>{esc(t)}</text>'


# ---------------------------------------------------------------- system diagram
def agent_diagram():
    p = []
    p.append(label(30, 32, "How the system works", 21, INK, bold=True))
    p.append(label(30, 55, "One bounced EMI: what calls what, and where each decision is actually made.", 15))

    # ---------------- band A: during the call
    p.append(label(30, 92, "DURING THE CALL", 13, ACCENT, bold=True, caps=True))
    p.append(label(816, 92, "WHAT THE SERVER CALLS", 13, ACCENT, bold=True, caps=True))
    p.append(box(30, 104, 182, 128, "Borrower's phone", ["Speaks Hindi,", "hears Meera"], ts=17))

    p.append(box(236, 100, 540, 186, "Collections server  ·  Node, running on Replit", [], fill=SOFT, stroke="#A9C6F5", ts=17, top=True))
    p.append(box(254, 156, 158, 48, "/call/transcribe", [], ts=14))
    p.append(box(426, 156, 158, 48, "/call/turn", [], ts=14))
    p.append(box(598, 156, 160, 48, "/call/speak", [], ts=14))
    p.append(label(506, 232, "Builds every prompt from the content files · enforces one payment link per call", 13, MUTED, "middle"))
    p.append(label(506, 254, "Writes every event to the database as it happens", 13, MUTED, "middle"))

    p.append(arrow(218, 138, 232, 138, label="audio in", ly=130))
    p.append(arrow(232, 196, 218, 196, label="audio out", ly=214))

    p.append(box(816, 104, 212, 72, "Sarvam AI", ["Speech to text,", "text to speech"]))
    p.append(box(816, 192, 212, 86, "Claude API", ["Turn prompt → JSON:", "say · speak · action · end"]))
    p.append(arrow(782, 150, 810, 142))
    p.append(arrow(782, 196, 810, 220))

    p.append(box(1062, 104, 268, 72, "Postgres", ["call_events: every event", "of every call"]))
    p.append(box(1062, 192, 268, 86, "GitHub  ·  call-logs branch", ["Transcript and events", "pushed after each call"]))
    p.append(label(1062, 92, "THE RECORD", 13, ACCENT, bold=True, caps=True))
    p.append(label(1330, 296, "Read by Claude Code between calls — see the next diagram", 12, ACCENT, "end"))

    # ---------------- band B: when the call ends
    p.append(label(30, 330, "WHEN THE CALL ENDS", 13, ACCENT, bold=True, caps=True))
    p.append(box(30, 342, 150, 112, "Call ends", ["/call/finish"]))
    p.append(arrow(186, 372, 214, 372))
    p.append(arrow(186, 424, 214, 424))

    p.append(box(218, 342, 234, 66, "Claude API · review", ["reason · promise · tone"], ts=15))
    p.append(box(218, 418, 234, 66, "Checks in code", ["the same rules, exactly"], ts=15))
    p.append(arrow(458, 372, 486, 388))
    p.append(arrow(458, 450, 486, 420))

    p.append(box(490, 352, 206, 112, "Facts + verdicts", ["A flag from either", "side counts as a breach"]))
    p.append(arrow(702, 408, 730, 408))

    p.append(box(734, 352, 250, 112, "Decision engine", ["Borrower history + this call", "Two questions, rules only", "The model never routes"]))
    p.append(arrow(990, 388, 1018, 360))
    p.append(arrow(990, 408, 1018, 408))
    p.append(arrow(990, 428, 1018, 456))
    p.append(box(1022, 334, 234, 52, "AI keeps dialling", [], ts=16))
    p.append(box(1022, 382, 234, 52, "A person calls", [], ts=16))
    p.append(box(1022, 430, 234, 52, "Field visit", [], ts=16))

    # ---------------- band C: content files
    p.append(box(236, 516, 748, 92, "What the agent says and where the thresholds sit: the content files", [], fill="#FAFBFD", ts=16, dash=True, top=True))
    p.append(label(610, 568, "agent.md · script.md · policy.json · guardrails.json · review-checks.json · decision-rules.json", 13, MUTED, "middle"))
    p.append(label(610, 590, "Read fresh on every call, so a change in tone or a threshold is a text edit, not a deploy.", 13, MUTED, "middle"))
    p.append(arrow(471, 514, 471, 292, dash=True))
    p.append(arrow(859, 514, 859, 470, dash=True))
    return svg(1360, 625, "".join(p))


# ---------------------------------------------------------------- build loop
def build_diagram():
    p = []
    p.append(label(30, 32, "How it was built", 21, INK, bold=True))
    p.append(label(30, 55, "A loop that closes in minutes, so a real call could change the agent the same evening.", 15))

    top = [
        ("1  Interviews", ["3 at a lender,", "transcribed by AI"]),
        ("2  Problem + rules", ["Mine: process,", "script, guardrails"]),
        ("3  Claude Code", ["Writes the code,", "tests, sample data"]),
        ("4  GitHub", ["Every change", "committed"]),
        ("5  Replit", ["Live app,", "auto-deployed"]),
    ]
    x = 30
    for i, (t, ls) in enumerate(top):
        p.append(box(x, 86, 232, 92, t, ls, fill=SOFT if i < 2 else "#FFFFFF", stroke="#A9C6F5" if i < 2 else RULE))
        if i < 4:
            p.append(arrow(x + 238, 132, x + 262, 132))
        x += 268

    p.append(arrow(1218, 184, 1218, 232))

    bottom = [
        ("9  Edit content files", ["A threshold or a line", "of script, not code"]),
        ("8  Claude reads them", ["What worked, what", "broke a rule"]),
        ("7  Logs to GitHub", ["Transcript and events", "pushed automatically"]),
        ("6  A real call", ["Placed on a phone,", "in Hindi"]),
    ]
    x = 298
    for t, ls in bottom:
        p.append(box(x, 240, 232, 92, t, ls, fill="#FFFFFF"))
        x += 268
    p.append(arrow(1096, 286, 1072, 286))
    p.append(arrow(828, 286, 804, 286))
    p.append(arrow(560, 286, 536, 286))

    p.append(arrow(414, 238, 414, 186, col=ACCENT))
    p.append(label(30, 362, "The loop closes here: what a live call revealed became a content edit, and the next call used it.", 14, ACCENT))
    return svg(1360, 380, "".join(p))


for name, maker in (("agent", agent_diagram), ("buildloop", build_diagram)):
    s = HERE / f"{name}.svg"
    s.write_text(maker(), encoding="utf-8")
    subprocess.run(["python3", SOFFICE, "--headless", "--convert-to", "png", "--outdir", str(HERE), str(s)], check=False, capture_output=True)
    print(name, "->", (HERE / f"{name}.png").exists())
