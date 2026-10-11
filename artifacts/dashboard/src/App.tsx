import type React from "react";
import { useEffect, useState } from "react";
import { getCallConfig, type CallConfig } from "./lib/api";
import { CallPage } from "./pages/CallPage";
import { CallsPage, CallDetailPage } from "./pages/CallsPage";
import { PerformancePage } from "./pages/PerformancePage";
import { QualityPage } from "./pages/QualityPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";

function useRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, "") || "/call");
  useEffect(() => {
    const on = () => setHash(window.location.hash.replace(/^#/, "") || "/call");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const route = useRoute();
  const [config, setConfig] = useState<CallConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    getCallConfig()
      .then(setConfig)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not reach the server"));
  }, []);

  const tab = route.startsWith("/how") ? "how" : route.startsWith("/quality") ? "quality" : route.startsWith("/performance") ? "performance" : route.startsWith("/calls") ? "calls" : "call";
  const detailId = route.startsWith("/calls/") ? route.slice("/calls/".length) : null;

  const titles: Record<string, [string, string]> = {
    call: ["Call", "Place a test call and see the customer's details"],
    calls: [detailId ? "Call review" : "Calls", detailId ? "Summary, data points and rule checks" : "Every call, newest first"],
    performance: ["Collections performance", "Is the agent recovering money?"],
    how: ["How it works", "From a bounced EMI to a reviewed call"],
    quality: ["Agent performance", "Is the agent safe to trust? Hard and judgement rule breaches"],
  };
  const [title, sub] = titles[tab];
  const steps = [
    { key: "call", href: "#/call", name: "Call", look: "Pick the borrower and talk to Meera. End the call when you are done." },
    { key: "calls", href: "#/calls", name: "Calls", look: "Every call lands here with its outcome, promise and the AI-or-person recommendation. Open one." },
    { key: "detail", href: "#/calls", name: "Call review", look: "Read the summary, the two-question recommendation and the transcript to see what drove it." },
    { key: "performance", href: "#/performance", name: "Collections performance", look: "Is the agent recovering money? Six metrics on a sample of 100 payments of ₹5,000." },
    { key: "quality", href: "#/quality", name: "Agent performance", look: "Is the agent safe to trust? Every rule, with how often it was broken." },
  ];
  const cur = steps.findIndex((x) => x.key === (tab === "calls" && detailId ? "detail" : tab));
  const next = cur >= 0 && cur < steps.length - 1 ? steps[cur + 1] : null;
  const item = (href: string, key: string, label: string, icon: React.ReactNode) => (
    <a href={href} aria-current={tab === key ? "page" : undefined}>{icon}{label}</a>
  );
  const ic = (d: string) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logoplate"><img src={`${import.meta.env.BASE_URL}razorpay-logo.png`} alt="Razorpay" height="20" /></span>
          <b>Trusted Collections Agent</b>
        </div>
      </header>
      <div className="layout">
        <nav className="side" aria-label="Sections">
          <div className="sec">Collections</div>
          {item("#/call", "call", "Call", ic("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"))}
          {item("#/calls", "calls", "Calls", ic("M4 6h16M4 12h16M4 18h10"))}
          {item("#/performance", "performance", "Collections performance", ic("M4 20V10M10 20V4M16 20v-8M22 20H2"))}
          {item("#/quality", "quality", "Agent performance", ic("M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4"))}
          <div className="sec">About</div>
          {item("#/how", "how", "How it works", ic("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.5"))}
          <div className="foot">{config?.testMode ? "Test mode: no real borrowers are called." : "Live mode"}</div>
        </nav>
        <main className="main">
          <div className="pagehead"><h1>{title}</h1><span>{sub}</span></div>
          {cur >= 0 && (
            <nav className="path" aria-label="Review path">
              <ol>
                {steps.map((x, i) => <li key={x.key} aria-current={i === cur ? "step" : undefined} className={i < cur ? "done" : ""}><span>{i + 1}</span>{x.name}</li>)}
              </ol>
              <div className="pathrow"><span><b>Step {cur + 1} of {steps.length}.</b> {steps[cur]!.look}</span>{next && <a className="btn sm" href={next.href}>Next: {next.name} →</a>}</div>
            </nav>
          )}
          {loadError ? (
            <div className="panel"><h2>Can't reach the server</h2><p className="note bad">{loadError}</p></div>
          ) : !config ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              {/* Always mounted so a call in progress is not cut off when the tab changes. */}
              <div hidden={tab !== "call"}><CallPage config={config} /></div>
              {tab === "calls" && (detailId ? <CallDetailPage id={detailId} /> : <CallsPage />)}
              {tab === "performance" && <PerformancePage />}
              {tab === "quality" && <QualityPage />}
              {tab === "how" && <HowItWorksPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
