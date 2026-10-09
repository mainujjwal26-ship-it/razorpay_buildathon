import { useMemo } from "react";
import type { CallConfig } from "../lib/api";
import { useCall } from "../lib/useCall";
import { Phone } from "../components/Phone";
import { CustomerCard } from "../components/CustomerCard";
import { createBrowserVoice, createSarvamVoice } from "../lib/voice";

export function CallPage({ config }: { config: CallConfig }) {
  const useSarvam = config.speechConfigured;
  const voice = useMemo(() => (useSarvam ? createSarvamVoice() : createBrowserVoice()), [useSarvam]);
  const call = useCall(voice);

  const customer = config.customers[0] ?? null;
  const live = call.phase !== "idle" && call.phase !== "ended";

  return (
    <div className="callrow">
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
      micOn={call.micOn}
      recording={call.recording}
      logCallId={config.callLogging ? call.callId : undefined}
      onMic={call.toggleMic}
    />
    {customer && <CustomerCard customer={customer} lender={config.lenderName} />}
    </div>
  );
}
