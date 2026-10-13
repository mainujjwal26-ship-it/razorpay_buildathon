import { useMemo } from "react";
import type { CallConfig } from "../lib/api";
import { useCall } from "../lib/useCall";
import { useDemoCall } from "../lib/useDemoCall";
import { DEMO_LINES } from "../lib/demo";
import { Phone } from "../components/Phone";
import { CustomerCard } from "../components/CustomerCard";
import { createBrowserVoice, createSarvamVoice } from "../lib/voice";

export function CallPage({ config, demo = false }: { config: CallConfig; demo?: boolean }) {
  const useSarvam = config.speechConfigured;
  const voice = useMemo(() => (useSarvam ? createSarvamVoice() : createBrowserVoice()), [useSarvam]);
  const liveCall = useCall(voice);
  const demoCall = useDemoCall(voice);
  const call = demo ? demoCall : liveCall;

  const customer = config.customers[0] ?? null;
  const live = call.phase !== "idle" && call.phase !== "ended";
  const note = demo && demoCall.step >= 0 ? DEMO_LINES[demoCall.step] : null;

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
        keyMissing={!demo && !config.llmConfigured}
        canStart={Boolean((demo || config.llmConfigured) && customer && !live)}
        onStart={() => (demo ? demoCall.start() : customer && liveCall.start(customer.id))}
        onEnd={call.end}
        onSubmit={call.submitTyped}
        micOn={call.micOn}
        recording={call.recording}
        logCallId={demo ? call.callId : config.callLogging ? call.callId : undefined}
        onMic={call.toggleMic}
        soundBlocked={call.soundBlocked}
        onEnableSound={call.enableSound}
        demo={demo}
      />
      <div className="stack">
        {demo && (
          <section className="panel watch" aria-live="polite">
            <header className="panel-h">
              <h2>{note ? note.title : "What to watch"}</h2>
              {note && <span className="chip neutral">{demoCall.step + 1} of {DEMO_LINES.length}</span>}
            </header>
            <p className="lead">
              {note
                ? note.note
                : "Press the green button. The call plays out line by line, in Hinglish, and this panel says what Meera is doing at each line and which of the lender's rules it satisfies."}
            </p>
            {note && (
              <div className="watch-prog" aria-hidden="true">
                {DEMO_LINES.map((_, i) => (
                  <i key={i} className={i <= demoCall.step ? "on" : ""} />
                ))}
              </div>
            )}
            {call.phase === "ended" && (
              <p className="note">The call is reviewed. Open it from the link on the phone, or use Calls in the sidebar.</p>
            )}
          </section>
        )}
        {customer && <CustomerCard customer={customer} lender={config.lenderName} />}
      </div>
    </div>
  );
}
