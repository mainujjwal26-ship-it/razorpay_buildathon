import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Load the recorder in isolation with browser/device and speech-service boundaries mocked.
const source = readFileSync(new URL("../../artifacts/dashboard/src/lib/microphone.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function setup({ denied = false, brokenRecorder = false, pendingPermission = false } = {}) {
  let time = 1000;
  let signal = 0;
  let tick;
  let grant;
  let stopped = 0;
  let resumes = 0;
  let recorderCount = 0;
  const uploads = [];
  const issues = [];
  const recording = [];
  const stream = { getTracks: () => [{ stop: () => { stopped++; } }] };
  const context = {
    state: "suspended",
    async resume() { resumes++; this.state = "running"; },
    createAnalyser() {
      return {
        fftSize: 1024,
        disconnect() {},
        getByteTimeDomainData(buffer) { buffer.fill(128 + signal); },
      };
    },
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; },
  };
  class Recorder {
    static isTypeSupported(mime) { return mime === "audio/webm;codecs=opus"; }
    constructor(_stream, options) {
      recorderCount++;
      if (brokenRecorder) throw new Error("recorder setup failed");
      this.mimeType = options?.mimeType || "audio/webm";
      this.state = "inactive";
    }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["recorded audio"]) });
      this.onstop?.();
    }
  }
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.equal(name, "./api");
      return {
        async transcribeAudio(blob) {
          uploads.push(blob);
          return "Haan, bolo";
        },
      };
    },
    Error, Blob, Promise, Uint8Array,
    Date: { now: () => time },
    window: { isSecureContext: true },
    navigator: {
      mediaDevices: {
        getUserMedia() {
          if (denied) {
            const error = new Error("permission denied");
            error.name = "NotAllowedError";
            return Promise.reject(error);
          }
          if (pendingPermission) return new Promise((resolve) => { grant = () => resolve(stream); });
          return Promise.resolve(stream);
        },
      },
    },
    MediaRecorder: Recorder,
    setInterval(callback) { tick = callback; return 1; },
    clearInterval() { tick = undefined; },
    setTimeout,
    clearTimeout,
  });
  return {
    listener: exports.listenToMicrophone(15000, () => context, (message) => issues.push(message), (value) => recording.push(value)),
    issues, recording, uploads,
    get stopped() { return stopped; },
    get resumes() { return resumes; },
    get recorderCount() { return recorderCount; },
    grant: () => grant(),
    sample(at, value) { time = at; signal = value; tick?.(); },
  };
}

test("resumes suspended audio analysis before recording", async () => {
  const fixture = setup();
  await flush();
  assert.equal(fixture.resumes, 1);
  assert.equal(fixture.recording.at(-1), true);
  fixture.listener.abort();
  assert.equal(await fixture.listener.result, null);
  assert.equal(fixture.recording.at(-1), false);
  assert.ok(fixture.stopped > 0);
});

test("quiet audio is submitted by the manual send button even without volume detection", async () => {
  const fixture = setup();
  await flush();
  fixture.listener.finishNow();
  assert.equal(await fixture.listener.result, "Haan, bolo");
  assert.equal(fixture.uploads.length, 1);
  assert.ok(fixture.uploads[0].size > 0);
  assert.equal(fixture.uploads[0].type, "audio/webm;codecs=opus");
});

test("speech beginning during calibration is not mistaken for background noise", async () => {
  const fixture = setup();
  await flush();
  fixture.sample(1050, 4);
  fixture.sample(1150, 4);
  fixture.sample(1400, 0);
  fixture.sample(3500, 0);
  assert.equal(await fixture.listener.result, "Haan, bolo");
  assert.equal(fixture.uploads.length, 1);
});

test("the no-speech timeout still submits recorded audio instead of discarding quiet speech", async () => {
  const fixture = setup();
  await flush();
  fixture.sample(16100, 0);
  assert.equal(await fixture.listener.result, "Haan, bolo");
  assert.equal(fixture.uploads.length, 1);
});

test("permission denial shows an actionable error and leaves typed replies available", async () => {
  const fixture = setup({ denied: true });
  await flush();
  assert.match(fixture.issues[0], /Microphone access is blocked/);
  assert.match(fixture.issues[0], /type your reply/);
  assert.equal(fixture.recorderCount, 0);
  fixture.listener.abort();
  assert.equal(await fixture.listener.result, null);
  assert.equal(fixture.uploads.length, 0);
});

test("recorder setup failure releases the microphone rather than hanging silently", async () => {
  const fixture = setup({ brokenRecorder: true });
  await flush();
  assert.match(fixture.issues[0], /recorder setup failed/);
  assert.ok(fixture.stopped > 0);
  fixture.listener.abort();
  assert.equal(await fixture.listener.result, null);
});

test("ending or muting while permission is pending releases the late stream", async () => {
  const fixture = setup({ pendingPermission: true });
  fixture.listener.abort();
  fixture.grant();
  await flush();
  assert.equal(await fixture.listener.result, null);
  assert.equal(fixture.recorderCount, 0);
  assert.ok(fixture.stopped > 0);
  assert.equal(fixture.uploads.length, 0);
});
