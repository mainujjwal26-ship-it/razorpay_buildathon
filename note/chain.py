"""The problem chain, drawn for a 1080p video frame."""
import subprocess, pathlib, html
HERE = pathlib.Path(__file__).parent
SOFFICE = "/root/.claude/skills/synced/801d8ccb-1c70-4f95-8137-fe7de82ad180_05499cb4-cba3-4854-b6bf-6f32bdab3162/docx/scripts/office/soffice.py"
FONT = "DejaVu Sans, Helvetica, Arial, sans-serif"
INK, MUTED, RULE = "#11243A", "#5B6B85", "#C9D2E0"
AMBER, RED = "#B45309", "#B3261E"

def esc(t): return html.escape(t)

def fit(text, size, width, bold=False):
    """Greedy wrap using an approximate glyph width for DejaVu Sans."""
    per = size * (0.60 if bold else 0.55)
    maxn = max(6, int(width / per))
    out, line = [], ""
    for w in text.split():
        t = (line + " " + w).strip()
        if len(t) <= maxn:
            line = t
        else:
            if line:
                out.append(line)
            line = w
    if line:
        out.append(line)
    return out

def text(x, y, lines, size, col, lh, bold=False):
    wt = ' font-weight="bold"' if bold else ""
    return "".join(
        f'<text x="{x}" y="{y + i*lh}" text-anchor="middle" font-family="{FONT}" font-size="{size}" fill="{col}"{wt}>{esc(l)}</text>'
        for i, l in enumerate(lines))

STAGES = [
    ("The EMI bounces", "Auto-debit fails. The borrower joins a queue of thousands.", RULE, INK, "#FFFFFF"),
    ("Everyone gets the same call", "One caller works about 400 borrowers. Same script, same pressure.", RULE, INK, "#FFFFFF"),
    ("The signal is lost", "A one-word disposition. Tone, intent and the real reason are never written down.", AMBER, AMBER, "#FEF8F0"),
    ("Effort goes to the wrong people", "Callbacks for borrowers who would have paid anyway. Nothing extra for the ones sliding away.", RULE, INK, "#FFFFFF"),
    ("The money does not come back", "Lower recovery, higher cost per rupee collected, more accounts sliding to NPA.", RED, RED, "#FDF3F3"),
]

W, H = 1920, 1080
MARGIN, GAP = 70, 30
bw = (W - 2*MARGIN - (len(STAGES)-1)*GAP) / len(STAGES)
inner = bw - 46
by, bh = 300, 430

p = [f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>']
p.append(text(W/2, 132, ["Why the money does not come back"], 58, INK, 0, bold=True))
p.append(text(W/2, 188, ["One bounced EMI, and the five steps that turn it into a loss."], 30, MUTED, 0))

for i, (title, body, stroke, tcol, fill) in enumerate(STAGES):
    x = MARGIN + i*(bw+GAP)
    cx = x + bw/2
    p.append(f'<rect x="{x}" y="{by}" width="{bw}" height="{bh}" rx="18" fill="{fill}" stroke="{stroke}" stroke-width="3"/>')
    p.append(f'<circle cx="{cx}" cy="{by+66}" r="31" fill="{tcol}"/>')
    p.append(text(cx, by+78, [str(i+1)], 33, "#FFFFFF", 0, bold=True))
    tl = fit(title, 30, inner, bold=True)
    p.append(text(cx, by+152, tl, 30, tcol, 38, bold=True))
    p.append(text(cx, by+152 + len(tl)*38 + 26, fit(body, 23, inner), 23, MUTED, 33))
    if i < len(STAGES)-1:
        ax = x + bw + 3
        p.append(f'<path d="M{ax} {by+bh/2} L{ax+GAP-9} {by+bh/2}" stroke="#7A8699" stroke-width="3.5" marker-end="url(#a)"/>')

bx = MARGIN + 2*(bw+GAP)
p.append(f'<rect x="{bx}" y="{by+bh+30}" width="{bw}" height="64" rx="13" fill="{AMBER}"/>')
p.append(text(bx+bw/2, by+bh+72, ["Where it breaks"], 28, "#FFFFFF", 0, bold=True))
p.append(text(W/2, by+bh+156, ["Everything after step 3 is the consequence of a signal nobody recorded."], 31, INK, 0, bold=True))

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
       f'<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
       f'<path d="M0 0L10 5L0 10z" fill="#7A8699"/></marker></defs>' + "".join(p) + "</svg>")
(HERE/"problem-chain.svg").write_text(svg, encoding="utf-8")
subprocess.run(["python3", SOFFICE, "--headless", "--convert-to", "png", "--outdir", str(HERE), str(HERE/"problem-chain.svg")], capture_output=True)
print((HERE/"problem-chain.png").exists())
