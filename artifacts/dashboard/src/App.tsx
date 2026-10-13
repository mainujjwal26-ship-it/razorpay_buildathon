import type React from "react";
import { useEffect, useState } from "react";
import { getCallConfig, getCalls, setDemoMode, type CallConfig } from "./lib/api";
import { DEMO_CONFIG, GUIDE } from "./lib/demo";
import { CallPage } from "./pages/CallPage";
import { CallsPage, CallDetailPage } from "./pages/CallsPage";
import { PerformancePage } from "./pages/PerformancePage";
import { QualityPage } from "./pages/QualityPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { PlanPage } from "./pages/PlanPage";

function useRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, "") || "/call");
  useEffect(() => {
    const on = () => setHash(window.location.hash.replace(/^#/, "") || "/call");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

const STEPS = [
  { key: "call", href: "#/call", name: "Make the call" },
  { key: "calls", href: "#/calls", name: "View call data" },
  { key: "detail", href: "#/calls", name: "Review the call" },
  { key: "performance", href: "#/performance", name: "Collections performance" },
  { key: "plan", href: "#/plan", name: "Plan next cycle" },
  { key: "quality", href: "#/quality", name: "Agent performance" },
];

type Mode = "demo" | "live";
const readMode = (): Mode => {
  try {
    return localStorage.getItem("mode") === "live" ? "live" : "demo";
  } catch {
    return "demo";
  }
};

export function App() {
  const route = useRoute();
  const [config, setConfig] = useState<CallConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(readMode);
  // Set before any child fetches, so the data layer is in the right mode.
  setDemoMode(mode === "demo");

  useEffect(() => {
    getCallConfig()
      .then(setConfig)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not reach the server"));
  }, []);

  const pick = (m: Mode) => {
    setMode(m);
    setDemoMode(m === "demo");
    try {
      localStorage.setItem("mode", m);
    } catch {
      /* private browsing: the choice just does not persist */
    }
    window.location.hash = "#/call";
  };

  const tab = route.startsWith("/plan") ? "plan" : route.startsWith("/how") ? "how" : route.startsWith("/quality") ? "quality" : route.startsWith("/performance") ? "performance" : route.startsWith("/calls") ? "calls" : "call";
  const detailId = route.startsWith("/calls/") ? route.slice("/calls/".length) : null;
  const demo = mode === "demo";

  const titles: Record<string, [string, string]> = {
    call: ["Call", "Place a test call and see the customer's details"],
    calls: [detailId ? "Call review" : "Calls", detailId ? "Summary, data points and rule checks" : "Every call, newest first"],
    performance: ["Collections performance", "Is the agent recovering money?"],
    plan: ["Plan next cycle", "What does the next cycle need to hit its target?"],
    how: ["How it works", "From a bounced EMI to a reviewed call"],
    quality: ["Agent performance", "Is the agent safe to trust? Hard and judgement rule breaches"],
  };
  const [title, sub] = titles[tab];
  const cur = STEPS.findIndex((x) => x.key === (tab === "calls" && detailId ? "detail" : tab));
  const guide = demo ? GUIDE[tab === "calls" && detailId ? "detail" : tab] : undefined;
  const go = async (i: number) => {
    const st = STEPS[Math.max(0, Math.min(STEPS.length - 1, i))]!;
    if (st.key === "detail") {
      const latest = await getCalls().then((r) => r.calls[0]?.id).catch(() => undefined);
      window.location.hash = latest ? `#/calls/${latest}` : "#/calls";
    } else window.location.hash = st.href;
  };
  const item = (href: string, key: string, label: string, icon: React.ReactNode) => (
    <a href={href} aria-current={tab === key ? "page" : undefined}>{icon}{label}</a>
  );
  const ic = (d: string) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );

  // In demo mode nothing needs the server, so a failed config does not stop the walkthrough.
  const cfg = config ?? (demo ? DEMO_CONFIG : null);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logoplate"><img src={`${import.meta.env.BASE_URL}razorpay-logo.png`} alt="Razorpay" height="20" /></span>
          <b>Trusted Collections Agent</b>
        </div>
        <div className="stepper" role="group" aria-label="Review steps">
          <button type="button" aria-label="Previous step" disabled={cur <= 0} onClick={() => void go(cur - 1)}>←</button>
          <span className="stepname">{cur >= 0 ? `Step ${cur + 1}: ${STEPS[cur]!.name}` : "Start the review"}</span>
          <button type="button" aria-label="Next step" disabled={cur === STEPS.length - 1} onClick={() => void go(cur + 1)}>→</button>
        </div>
        <div className="modesw" role="group" aria-label="Mode">
          <button type="button" aria-pressed={demo} onClick={() => pick("demo")}>Demo</button>
          <button type="button" aria-pressed={!demo} onClick={() => pick("live")}>Live</button>
        </div>
      </header>
      <div className="layout">
        <nav className="side" aria-label="Sections">
          <div className="sec">Collections</div>
          {item("#/call", "call", "Call", ic("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"))}
          {item("#/calls", "calls", "Calls", ic("M4 6h16M4 12h16M4 18h10"))}
          {item("#/performance", "performance", "Collections performance", ic("M4 20V10M10 20V4M16 20v-8M22 20H2"))}
          {item("#/plan", "plan", "Plan next cycle", ic("M3 20h18M7 20V9M12 20V4M17 20v-7"))}
          {item("#/quality", "quality", "Agent performance", ic("M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4"))}
          <div className="sec">About</div>
          {item("#/how", "how", "How it works", ic("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.5"))}
          <div className="foot">{demo ? "Demo mode: sample data, no borrower is called." : "Live mode: a real call, reviewed by the model."}</div>
        </nav>
        <main className={`main${demo ? " demo" : ""}`}>
          <div className="pagehead"><h1>{title}</h1><span>{sub}</span></div>
          {guide && (
            <div className="guide">
              <b>{guide.title}</b>
              <span>{guide.body}</span>
            </div>
          )}
          {loadError && !demo ? (
            <div className="panel"><h2>Can't reach the server</h2><p className="note bad">{loadError}</p></div>
          ) : !cfg ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              {/* Always mounted so a call in progress is not cut off when the tab changes. */}
              <div hidden={tab !== "call"}><CallPage config={cfg} demo={demo} key={demo ? "demo" : "live"} /></div>
              {tab === "calls" && (detailId ? <CallDetailPage id={detailId} /> : <CallsPage />)}
              {tab === "performance" && <PerformancePage />}
              {tab === "plan" && <PlanPage />}
              {tab === "quality" && <QualityPage />}
              {tab === "how" && <HowItWorksPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
