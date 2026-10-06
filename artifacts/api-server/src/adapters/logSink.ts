/**
 * Log sink adapter. Pushes each call's log file to a `call-logs` branch on GitHub so it reaches the
 * repo without anyone committing. Off unless GITHUB_LOG_TOKEN is set. Never throws into a call.
 */
const API = process.env["GITHUB_API_URL"] ?? "https://api.github.com";
const repo = () => process.env["GITHUB_LOG_REPO"] ?? "mainujjwal26-ship-it/razorpay_buildathon";
const branch = () => process.env["GITHUB_LOG_BRANCH"] ?? "call-logs";

export const sinkConfigured = () => Boolean(process.env["GITHUB_LOG_TOKEN"]);

async function gh(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}/repos/${repo()}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env["GITHUB_LOG_TOKEN"]}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "meera-call-logs",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let branchReady = false;
async function ensureBranch(): Promise<void> {
  if (branchReady) return;
  if ((await gh("GET", `/git/ref/heads/${branch()}`)).status === 200) return void (branchReady = true);
  const repoInfo = await gh("GET", "");
  const base = await gh("GET", `/git/ref/heads/${repoInfo.json?.default_branch ?? "main"}`);
  const sha = base.json?.object?.sha;
  if (!sha) throw new Error(`GitHub: cannot find the default branch (${base.status})`);
  const made = await gh("POST", "/git/refs", { ref: `refs/heads/${branch()}`, sha });
  if (made.status >= 300 && made.status !== 422) throw new Error(`GitHub: cannot create branch (${made.status})`);
  branchReady = true;
}

/** Create or update call-logs/<file> on the branch with the given text. */
export async function pushLogFile(file: string, content: string): Promise<void> {
  await ensureBranch();
  const path = `/contents/call-logs/${file}`;
  const existing = await gh("GET", `${path}?ref=${branch()}`);
  const put = await gh("PUT", path, {
    message: `call log ${file}`,
    content: Buffer.from(content).toString("base64"),
    branch: branch(),
    ...(existing.status === 200 ? { sha: existing.json.sha } : {}),
  });
  if (put.status >= 300) throw new Error(`GitHub: could not save ${file} (${put.status}: ${put.json?.message ?? ""})`);
}
