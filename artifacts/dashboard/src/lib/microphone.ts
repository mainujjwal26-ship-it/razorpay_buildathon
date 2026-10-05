import { transcribeAudio } from "./api";
import type { Listener } from "./voice";

export function microphoneError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow microphone access in your browser's site settings. If this is an embedded preview, open the app in its own tab. You can type your reply instead.";
  }
  if (name === "NotFoundError") return "No microphone was found. Connect a microphone, or type your reply instead.";
  if (name === "NotReadableError") return "Your microphone is unavailable or in use by another app. Close other recording apps, or type your reply instead.";
  return `Voice input could not start: ${error instanceof Error ? error.message : "unknown error"}. You can type your reply instead.`;
}

export async function resumeMicrophoneContext(context: AudioContext): Promise<void> {
  const currentState = () => context.state;
  if (currentState() === "running") return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.resume(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Audio input is paused. Tap the mic off and back on to retry")), 3000);
      }),
    ]);
    if (currentState() !== "running") throw new Error("Audio input is paused. Tap the mic off and back on to retry");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Own every recorder resource, including setup failures and cancellation during permission prompts. */
export function listenToMicrophone(
  timeoutMs: number,
  getContext: () => AudioContext,
  onIssue?: (message: string) => void,
  onRecording?: (recording: boolean) => void,
): Listener {
  let aborted = false;
  let settled = false;
  let failed = false;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  let resolveResult: (text: string | null) => void = () => undefined;
  const result = new Promise<string | null>((resolve) => { resolveResult = resolve; });

  const release = () => {
    if (tick) clearInterval(tick);
    tick = undefined;
    source?.disconnect();
    analyser?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    onRecording?.(false);
  };
  const finish = (text: string | null) => {
    if (settled) return;
    settled = true;
    release();
    resolveResult(text);
  };
  const issue = (message: string) => {
    if (aborted || settled || failed) return;
    failed = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    release();
    onIssue?.(message);
    // Keep the turn open for a typed reply or a microphone retry, not a synthetic silence turn.
  };

  void (async () => {
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone recording requires a secure browser tab");
      }
      if (typeof MediaRecorder === "undefined") throw new Error("This browser does not support audio recording");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (aborted) return release();
      const context = getContext();
      await resumeMicrophoneContext(context);
      if (aborted) return release();
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
        .find((mime) => MediaRecorder.isTypeSupported(mime));
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => issue("Audio recording failed. Tap the mic off and back on to retry, or type your reply instead.");
      recorder.onstop = () => {
        release();
        if (aborted || failed || settled) return;
        const audio = new Blob(chunks, { type: recorder?.mimeType || mimeType || "audio/webm" });
        if (!audio.size) return issue("No audio was recorded. Check your microphone, or type your reply instead.");
        // Submit even quiet recordings: the speech service, not the volume threshold, decides if words were spoken.
        void transcribeAudio(audio).then(
          (text) => { if (!aborted && !failed) finish(text || null); },
          (error: unknown) => issue(`Could not transcribe your voice: ${error instanceof Error ? error.message : "unknown error"}. You can type your reply instead.`),
        );
      };
      const startedAt = Date.now();
      let speechAt = 0;
      let lastLoud = 0;
      let floor = 0;
      let count = 0;
      recorder.start();
      onRecording?.(true);
      tick = setInterval(() => {
        if (!analyser || !recorder || recorder.state === "inactive") return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const value of samples) sum += ((value - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / samples.length);
        const now = Date.now();
        // Don't treat someone speaking immediately as the room's noise floor.
        if (now - startedAt < 400) {
          floor = (floor * count + rms) / (++count);
        }
        const threshold = Math.max(0.006, Math.min(floor, 0.004) * 2);
        if (rms > (speechAt ? threshold * 0.6 : threshold)) {
          speechAt ||= now;
          lastLoud = now;
        }
        if ((speechAt && now - lastLoud > 2200) ||
            (speechAt && now - speechAt > 20000) ||
            (!speechAt && now - startedAt > timeoutMs)) {
          if (tick) clearInterval(tick);
          recorder.stop();
        }
      }, 50);
    } catch (error) {
      issue(microphoneError(error));
    }
  })();

  return {
    result,
    abort() {
      aborted = true;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      finish(null);
    },
    finishNow() {
      if (recorder?.state === "recording") {
        if (tick) clearInterval(tick);
        recorder.stop();
      }
    },
  };
}
