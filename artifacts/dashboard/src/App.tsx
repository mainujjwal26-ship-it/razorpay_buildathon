import type React from "react";
import { useEffect, useState } from "react";
import { getCallConfig, type CallConfig } from "./lib/api";
import { CallPage } from "./pages/CallPage";
import { CallsPage, CallDetailPage } from "./pages/CallsPage";
import { PerformancePage } from "./pages/PerformancePage";
import { QualityPage } from "./pages/QualityPage";

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

  const tab = route.startsWith("/quality") ? "quality" : route.startsWith("/performance") ? "performance" : route.startsWith("/calls") ? "calls" : "call";
  const detailId = route.startsWith("/calls/") ? route.slice("/calls/".length) : null;

  const titles: Record<string, [string, string]> = {
    call: ["Call", "Place a test call and see the customer's details"],
    calls: [detailId ? "Call review" : "Calls", detailId ? "Summary, data points and rule checks" : "Every call, newest first"],
    performance: ["Performance", "How the collections team is doing"],
    quality: ["Quality", "Can we trust the calls? Rule breaches and checks"],
  };
  const [title, sub] = titles[tab];
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
        {config?.testMode && <span className="testwrap">Test mode <span className="sw" aria-hidden="true" /></span>}
      </header>
      <div className="layout">
        <nav className="side" aria-label="Sections">
          <div className="sec">Collections</div>
          {item("#/call", "call", "Call", ic("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"))}
          {item("#/calls", "calls", "Calls", ic("M4 6h16M4 12h16M4 18h10"))}
          {item("#/performance", "performance", "Performance", ic("M4 20V10M10 20V4M16 20v-8M22 20H2"))}
          {item("#/quality", "quality", "Quality", ic("M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4"))}
          <div className="foot">{config?.testMode ? "Test mode: no real borrowers are called." : "Live mode"}</div>
        </nav>
        <main className="main">
          <div className="pagehead"><h1>{title}</h1><span>{sub}</span></div>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
