import { loadScript } from "../lib/content";

/** Markdown-escaped brackets and entities in the script doc, cleaned for use. */
export function cleanScriptText(s: string): string {
  return s
    .replace(/&#32;/g, " ")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/[ ]{2,}/g, " ");
}

/** Reads a fixed line (e.g. "F1") from the script's fixed-lines table: | # | When | Line | Guardrail | */
export function getFixedLine(id: string): string | null {
  const script = loadScript();
  for (const raw of script.split("\n")) {
    if (!raw.startsWith("|")) continue;
    const cells = raw
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length >= 4 && cells[0] === id) return cleanScriptText(cells[2] ?? "");
  }
  return null;
}

/** Fills [Name]-style brackets from known values. Unknown brackets are left as-is. */
export function fillBrackets(line: string, values: Record<string, string>): string {
  return line.replace(/\[([^\]]+)\]/g, (m, key: string) => values[key] ?? m);
}
