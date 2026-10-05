import { useEffect, useMemo, useState } from "react";
import { getCallConfig, type CallConfig } from "../lib/api";
import { useCall } from "../lib/useCall";
import { Phone } from "../components/Phone";
import { createBrowserVoice, createSarvamVoice } from "../lib/voice";

export function CallPage() {
  const [config, setConfig] = useState<CallConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const useSarvam = config?.speechConfigured ?? false;
  const voice = useMemo(() => (useSarvam ? createSarvamVoice() : createBrowserVoice()), [useSarvam]);
  const call = useCall(voice);

  useEffect(() => {
    getCallConfig()
      .then(setConfig)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Could not reach the server"));
  }, []);

  if (loadError) {
    return (
      <div className="phone">
        <div className="screen">
          <div className="start">
            <p className="who-called"><b>Can't reach the server</b></p>
            <p className="note bad">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }
  if (!config) return <p className="muted">Loading…</p>;

  const customer = config.customers[0] ?? null;
  const live = call.phase !== "idle" && call.phase !== "ended";

  return (
    <Phone
      agentName={config.agentName}
      lenderName={config.lenderName}
      summary={customer ? { name: customer.name, emiAmount: customer.emiAmount, daysPastDue: customer.daysPastDue } : null}
      phase={call.phase}
      lines={call.lines}
      seconds={call.seconds}
      micIssue={call.micIssue}
      error={call.error}
      keyMissing={!config.llmConfigured}
      canStart={Boolean(config.llmConfigured && customer && !live)}
      onStart={() => customer && call.start(customer.id)}
      onEnd={call.end}
      onSubmit={call.submitTyped}
    />
  );
}
