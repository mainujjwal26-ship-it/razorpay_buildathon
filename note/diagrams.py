"""Draws the two diagrams for the AI build log as SVG, then renders them to PNG.

Kept as source so a change is a text edit, not a redraw.
"""
import subprocess, pathlib, html

HERE = pathlib.Path(__file__).parent
INK, MUTED, RULE, ACCENT, SOFT = "#11243A", "#5B6B85", "#C9D2E0", "#1A4FD6", "#EEF3FB"
FONT = "DejaVu Sans, Helvetica, Arial, sans-serif"


def esc(t):
    return html.escape(t)


def box(x, y, w, h, title, lines=(), fill="#FFFFFF", stroke=RULE, tcol=INK, ts=19, ls=15, dash=None, top=False):
    d = f' stroke-dasharray="7 5"' if dash else ""
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"{d}/>']
    ty = y + ts + 14 if top else y + (h - (len(lines) * (ls + 6) + ts)) / 2 + ts
    out.append(f'<text x="{x + w/2}" y="{ty}" text-anchor="middle" font-family="{FONT}" font-size="{ts}" font-weight="bold" fill="{tcol}">{esc(title)}</text>')
    for i, l in enumerate(lines):
        out.append(f'<text x="{x + w/2}" y="{ty + 8 + (i + 1) * (ls + 6)}" text-anchor="middle" font-family="{FONT}" font-size="{ls}" fill="{MUTED}">{esc(l)}</text>')
    return "".join(out)


def arrow(x1, y1, x2, y2, dash=False, label=None, col=None):
    c = col or "#7A8699"
    d = ' stroke-dasharray="6 5"' if dash else ""
    s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2.2" marker-end="url(#a)"{d}/>'
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        s += f'<text x="{mx}" y="{my - 9}" text-anchor="middle" font-family="{FONT}" font-size="14" fill="{MUTED}">{esc(label)}</text>'
    return s


def svg(w, h, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="#7A8699"/></marker></defs>'
        f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>{body}</svg>'
    )


def label(x, y, t, size=15, col=MUTED, anchor="start", bold=False):
    wt = ' font-weight="bold"' if bold else ""
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{FONT}" font-size="{size}" fill="{col}"{wt}>{esc(t)}</text>'


# ---------------------------------------------------------------- diagram 1
def agent_diagram():
    p = []
    p.append(label(30, 34, "How the agent works", 21, INK, bold=True))
    p.append(label(30, 58, "One bounced EMI, from the auto-debit failure to a routed borrower.", 15))

    p.append(box(30, 90, 190, 86, "EMI bounces", ["Auto-debit fails", "on the due date"]))
    p.append(arrow(226, 133, 268, 133))

    # the call
    p.append(box(272, 78, 320, 158, "The call", [], fill=SOFT, stroke="#A9C6F5", top=True))
    p.append(label(432, 141, "Speech in → model → speech out", 15, INK, "middle"))
    p.append(label(432, 166, "Identity first · reason · promise", 14, MUTED, "middle"))
    p.append(label(432, 188, "One payment link · ticket · handoff", 14, MUTED, "middle"))
    p.append(label(432, 218, "Hindi / Hinglish, under 3 minutes", 13, MUTED, "middle"))
    p.append(arrow(598, 133, 640, 133))

    p.append(box(644, 90, 190, 86, "Review", ["Facts extracted,", "every rule checked"]))
    p.append(arrow(840, 133, 882, 133))

    p.append(box(886, 82, 200, 102, "Decision", ["1. Has intent shifted?", "2. Was the AI let down?"], top=True))

    # routes
    p.append(arrow(1090, 124, 1132, 88))
    p.append(arrow(1090, 133, 1132, 133))
    p.append(arrow(1090, 142, 1132, 178))
    p.append(box(1136, 60, 194, 56, "AI keeps dialling", [], ts=16))
    p.append(box(1136, 105, 194, 56, "A person calls", [], ts=16))
    p.append(box(1136, 150, 194, 56, "Field visit", [], ts=16))

    p.append(label(739, 202, "Reason · root cause · promise", 13, MUTED, "middle"))
    p.append(label(739, 221, "Tone · cooperation · tickets", 13, MUTED, "middle"))

    # content layer
    p.append(box(272, 300, 814, 92, "Behaviour lives in content files, read fresh on every call", [], fill="#FAFBFD", ts=17, dash=True, top=True))
    p.append(label(679, 352, "agent.md · script.md · policy.json · guardrails.json · review-checks.json · decision-rules.json", 14, MUTED, "middle"))
    p.append(label(679, 376, "Changing what she says, or the bounce threshold that routes a borrower, is a text edit — not a deploy.", 13, MUTED, "middle"))
    p.append(arrow(432, 298, 432, 242, dash=True))
    p.append(arrow(739, 298, 739, 234, dash=True))
    p.append(arrow(986, 298, 986, 190, dash=True))

    # the rule note
    p.append(label(30, 348, "Rules decide.", 15, INK, bold=True))
    p.append(label(30, 370, "The model only", 14))
    p.append(label(30, 388, "extracts the facts.", 14))
    return svg(1360, 410, "".join(p))


# ---------------------------------------------------------------- diagram 2
def build_diagram():
    p = []
    p.append(label(30, 34, "How it was built", 21, INK, bold=True))
    p.append(label(30, 58, "A loop that closes in minutes, so a real call could change the agent the same evening.", 15))

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

    # close the loop: the content edit feeds straight back into what the agent does
    p.append(arrow(414, 238, 414, 186, col="#1A4FD6"))
    p.append(label(30, 362, "The loop closes here: what a live call revealed became a content edit, and the next call used it.", 14, ACCENT))
    return svg(1360, 380, "".join(p))


for name, maker in (("agent", agent_diagram), ("buildloop", build_diagram)):
    s = HERE / f"{name}.svg"
    s.write_text(maker(), encoding="utf-8")
    subprocess.run(
        ["python3", "/root/.claude/skills/synced/801d8ccb-1c70-4f95-8137-fe7de82ad180_05499cb4-cba3-4854-b6bf-6f32bdab3162/docx/scripts/office/soffice.py",
         "--headless", "--convert-to", "png", "--outdir", str(HERE), str(s)],
        check=False, capture_output=True,
    )
    print(name, "->", (HERE / f"{name}.png").exists())
