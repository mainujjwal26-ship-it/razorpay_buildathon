import type { Policy } from "../lib/content";

/** Hard rules the code enforces itself, so rewriting prompts can never break them. */
export function checkCallingHours(now: Date, policy: Policy): { ok: boolean; localTime: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: policy.callingHours.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const cur = toMin(parts);
  return {
    ok: cur >= toMin(policy.callingHours.start) && cur < toMin(policy.callingHours.end),
    localTime: parts,
  };
}
