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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <b>{config?.lenderName ?? "Collections"}</b>
          <span>Post-bounce collections · {config?.agentName ?? "Meera"}</span>
        </div>
        <nav aria-label="Sections">
          <a href="#/call" aria-current={tab === "call" ? "page" : undefined}>Call</a>
          <a href="#/calls" aria-current={tab === "calls" ? "page" : undefined}>Calls</a>
          <a href="#/performance" aria-current={tab === "performance" ? "page" : undefined}>Performance</a>
          <a href="#/quality" aria-current={tab === "quality" ? "page" : undefined}>Quality</a>
        </nav>
        {config?.testMode && <span className="testbadge">Test build</span>}
      </header>
      <main className="main">
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
  );
}
