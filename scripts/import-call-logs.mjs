// One-time development import. Never run at startup or during publishing.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

if (process.env.NODE_ENV === "production") throw new Error("Import is development-only.");
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const dir = path.resolve(process.argv[2] ?? "call-logs");
let inserted = 0;
try {
  for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl")).sort()) {
    const lines = (await fs.readFile(path.join(dir, file), "utf8")).split("\n").filter(Boolean);
    for (const [offset, line] of lines.entries()) {
      const event = JSON.parse(line);
      if (!event.callId || !event.type || !Number.isFinite(Date.parse(event.ts))) {
        throw new Error(`Invalid event in ${file} at line ${offset + 1}`);
      }
      // Stable IDs make repeated imports harmless, including repeated identical events.
      const hash = createHash("sha256").update(`${file}:${offset}:${line}`).digest("hex").slice(0, 32);
      const eventId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
      const result = await pool.query(
        "INSERT INTO call_events(event_id, call_id, type, occurred_at, event) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [eventId, event.callId, event.type, event.ts, JSON.stringify(event)],
      );
      inserted += result.rowCount;
    }
  }
  console.log(`Imported ${inserted} events into the development database. Original files were preserved.`);
} finally {
  await pool.end();
}
