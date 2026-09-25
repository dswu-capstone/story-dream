const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const { FocusEventSender } = require("../app/lib/FocusEventSender");
const { FocusRecording } = require("../app/lib/FocusRecording");
const { FocusMonitor } = require("../app/lib/FocusMonitor");
const { AppConfig } = require("../app/lib/AppConfig");

const payload = (eventId = "A", eventType = "focus_lost", durationSeconds = 10) => ({
  eventId, eventType, occurredAt: "2026-09-18T10:15:30", durationSeconds
});
const accepted = status => ({ ok: true, status: 200,
  json: async () => ({ success: true, data: { status, logId: 1 }, message: null }) });
const sender = fetchImpl => new FocusEventSender({ baseUrl: "http://backend.test", fetchImpl,
  delay: async () => {}, log: () => {} });

test("HTTP retry keeps the original ID and exact body", async () => {
  const bodies = [];
  const delays = [];
  const out = sender(async (url, request) => {
    assert.equal(url, "http://backend.test/api/reading-histories/10/focus-events");
    bodies.push(JSON.parse(request.body));
    if (bodies.length < 3) throw new Error("network unavailable");
    return accepted("ALREADY_PROCESSED");
  });
  out.delay = async ms => delays.push(ms);
  out.enqueue(10, { ...payload(), partType: "BODY", level: 3 });
  await out.flush();
  assert.equal(bodies.length, 3);
  assert.deepEqual(bodies, [payload(), payload(), payload()]);
  assert.deepEqual(delays, [1000, 2000]);
  assert.equal(out.pending.length, 0);
});

test("recovery is delivered only after creation is acknowledged", async () => {
  const seen = [];
  const out = sender(async (_, request) => {
    const p = JSON.parse(request.body);
    seen.push(p);
    if (seen.length === 1) throw new Error("lost response");
    return accepted(p.eventType === "focus_recovered" ? "RECOVERED" : "ALREADY_PROCESSED");
  });
  out.enqueue(10, payload());
  out.enqueue(10, payload("A", "focus_recovered", 30));
  await out.flush();
  assert.deepEqual(seen.map(p => [p.eventId, p.durationSeconds]), [["A", 10], ["A", 10], ["A", 30]]);
});

test("bounded retries retain a failed event for explicit retry without a new ID", async () => {
  let calls = 0;
  const out = sender(async () => { calls++; throw new Error("offline"); });
  out.enqueue(10, payload());
  await assert.rejects(out.flush(), /offline/);
  assert.equal(calls, 4);
  assert.equal(out.pending[0].body.eventId, "A");
  out.fetch = async () => accepted("SAVED");
  await out.flush();
  assert.equal(out.pending.length, 0);
});

test("permanent API error does not run rapid retries", async () => {
  let calls = 0;
  const out = sender(async () => { calls++; return { ok: false, status: 400, json: async () => ({ success: false }) }; });
  out.enqueue(10, payload());
  await assert.rejects(out.flush(), /400/);
  assert.equal(calls, 1);
});

test("cancellation prevents delayed retries after reading ends", async () => {
  let calls = 0;
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const out = sender(async () => { calls++; throw new Error("offline"); });
  out.delay = () => waiting;
  out.enqueue(10, payload());
  await new Promise(resolve => setImmediate(resolve));
  out.cancel();
  release();
  await out.flush();
  assert.equal(calls, 1);
  assert.equal(out.pending.length, 0);
});

function recorderFixture() {
  const out = sender(async (_, request) => accepted(JSON.parse(request.body).eventType === "focus_recovered" ? "RECOVERED" : "SAVED"));
  const recorder = new FocusRecording({ enabled: true, timezone: "UTC", sender: out });
  const commands = [];
  const child = { stdin: new Writable({ write(chunk, encoding, callback) {
    const command = JSON.parse(chunk.toString());
    commands.push(command);
    queueMicrotask(() => recorder.handleLine("FOCUS_ACK " + JSON.stringify({ requestId: command.requestId })));
    callback();
  } }) };
  recorder.attach(child);
  return { recorder, out, commands, child };
}

test("reading ID reaches Python control, and stop only disables recording", async () => {
  const { recorder, commands, child } = recorderFixture();
  await recorder.setSession(10, true);
  assert.equal(commands[0].readingHistoryId, 10);
  assert.equal(commands[0].timezone, "UTC");
  assert.equal(commands[0].detect, true);
  await recorder.flush(10);
  assert.equal(commands.at(-1).detect, false);
  await recorder.finishSession(10);
  assert.equal(commands.at(-1).action, "stop");
  assert.equal(recorder.child, child); // never terminates the interaction camera
  assert.equal(recorder.historyId, null);
});

test("no active history or stale history means no backend enqueue", async () => {
  const { recorder, out } = recorderFixture();
  const line = "FOCUS_EVENT " + JSON.stringify({ readingHistoryId: 10, payload: payload() });
  recorder.handleLine(line);
  assert.equal(out.pending.length, 0);
  await recorder.setSession(11, true);
  recorder.handleLine(line);
  assert.equal(out.pending.length, 0);
  await recorder.finishSession(11);
  recorder.handleLine(line);
  assert.equal(out.pending.length, 0);
});

test("existing browser and camera HTTP interaction signals still reach SSE unchanged", () => {
  const seen = [];
  const monitor = new FocusMonitor({ enabled: true, sse: { broadcast: (kind, signal) => seen.push([kind, signal]) } });
  for (const source of ["camera-focus", "story-reading-browser"]) {
    monitor.handleSignal({ eventType: "focus_lost", state: "side", source, detail: "distracted_for=15.0s", timestamp: "original" });
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0][1].timestamp, "original");
  assert.equal(seen[1][1].source, "story-reading-browser");
  assert.equal(monitor.recording.sender.pending.length, 0);
});

test("recording events never become extra frontend interaction events", async () => {
  const { recorder } = recorderFixture();
  await recorder.setSession(10, true);
  assert.equal(recorder.handleLine("FOCUS_EVENT " + JSON.stringify({ readingHistoryId: 10, payload: payload() })), true);
  await recorder.sender.flush();
  recorder.cancel();
});

test("Backend address comes from configuration, browser source default is preserved", () => {
  const config = new AppConfig({ BACKEND_BASE_URL: "https://configured.test", FOCUS_TIME_ZONE: "UTC" }, __dirname);
  assert.equal(config.backendBaseUrl, "https://configured.test");
  assert.equal(config.focusSource, "browser");
  assert.equal(config.cameraFocusEnabled, false);
});
