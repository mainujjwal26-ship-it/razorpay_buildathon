import { CallPage } from "./pages/CallPage";

const DASHBOARD = ["Customers", "Guardrails", "Talking", "Script", "Metrics"];

export function App() {
  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <div className="brand">
          <b>Goel Small Finance Bank</b>
          <span>Collections · post-bounce</span>
        </div>
        <div className="navh">DASHBOARD</div>
        {DASHBOARD.map((n) => (
          <span key={n} className="nav off" aria-disabled="true">
            {n}
            <em>soon</em>
          </span>
        ))}
        <div className="navh">CONVERSATIONS</div>
        <span className="nav on" aria-current="page">Call</span>
        <span className="nav off" aria-disabled="true">
          Chat
          <em>soon</em>
        </span>
      </nav>
      <main className="main">
        <header className="top">
          <h1>Call</h1>
          <span className="muted small">Talk to the agent as the borrower</span>
        </header>
        <div className="wrap">
          <CallPage />
        </div>
      </main>
    </div>
  );
}
