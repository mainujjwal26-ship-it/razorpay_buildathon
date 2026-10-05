import fs from "node:fs";
import path from "node:path";

/**
 * Everything the agent says or believes lives in /content (and /evals), not in code.
 * Files are read fresh on every call so edits apply without a rebuild.
 */
function findContentDir(): string {
  if (process.env["CONTENT_DIR"]) return path.resolve(process.env["CONTENT_DIR"]);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "content");
    if (fs.existsSync(path.join(candidate, "policy.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "Could not find the /content folder. Set CONTENT_DIR or run from the repo root.",
  );
}

export function readContentText(relPath: string): string {
  return fs.readFileSync(path.join(findContentDir(), relPath), "utf8");
}

export function readContentJson<T>(relPath: string): T {
  return JSON.parse(readContentText(relPath)) as T;
}

export interface Policy {
  version: number;
  lenderName: string;
  agentName: string;
  minUpfrontPercent: number;
  balanceDueBeforeDpd: number;
  waiverOnlyOnFullPayment: boolean;
  maxOfferRounds: number;
  maxCallsPerWeek: number;
  callingHours: { start: string; end: string; timezone: string };
  testMode: boolean;
}

export interface Customer {
  id: string;
  name: string;
  displayName: string;
  emiAmount: number;
  emiDueDate: string;
  bounced: boolean;
  daysPastDue: number;
  callNumberThisWeek: number;
  lastCall: string;
  brokenPromise: string;
  language: string;
  notes: string;
}

export interface GuardrailGroup {
  group: number;
  name: string;
  note: string | null;
  items: { id: string; text: string; type: "Hard" | "Judgement"; source: string }[];
}

export const loadPolicy = () => readContentJson<Policy>("policy.json");
export const loadCustomers = () => readContentJson<Customer[]>("customers/customers.json");
export const loadGuardrails = () => readContentJson<GuardrailGroup[]>("guardrails.json");
export const loadTalking = () => readContentJson<Record<string, unknown>>("talking.json");
export const loadScript = () => readContentText("script.md");
export const loadAgentTemplate = () => readContentText("prompts/agent.md");

export function getCustomer(id: string): Customer | undefined {
  return loadCustomers().find((c) => c.id === id);
}
