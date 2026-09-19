const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ source = "camera", expected = "camera", rejectFlush = false, timezone = "UTC", focusResponder, enforceBrowserReceiver = false } = {}) {
  const calls = [];
  let seconds = 0;
  let sequence = 0;
  const fakeFetch = async function (url, init) {
    if (enforceBrowserReceiver && this?.fetch !== fakeFetch) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.endsWith("/session") && !init?.body) {
      return { ok: true, json: async () => ({ ok: true, focus: { source, timezone } }) };
    }
    if (url.endsWith("/focus/session")) {
      return { ok: !(rejectFlush && body.action === "flush"), json: async () => ({
        ok: !(rejectFlush && body.action === "flush"), enabled: true, error: "pending focus event"
      }) };
    }
    if (url.endsWith("/focus-events")) {
      if (focusResponder) return focusResponder(body);
      return { ok: true, json: async () => ({ success: true, data: {
        status: body.eventType === "focus_recovered" ? "RECOVERED" : "SAVED", logId: 1,
      } }) };
    }
    return { ok: true, json: async () => ({ success: true, data: {} }) };
  };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    if (name === "realtimeInteraction") return { realtimeInteractionApiBase: "/interaction-api" };
    const source = fs.readFileSync(path.join(__dirname, "../src/api", `${name}.ts`), "utf8")
      .replaceAll("import.meta.env", JSON.stringify({ VITE_FOCUS_SOURCE: expected }));
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    cache[name] = exports;
    vm.runInNewContext(code, { exports, require: p => load(p.replace("./", "")), fetch: fakeFetch,
      AbortSignal, console, setTimeout, performance: { now: () => seconds * 1000 },
      crypto: { randomUUID: () => `event-${++sequence}` }, localStorage: { getItem: () => "test-token" } });
    return exports;
  }
  return { calls, load, time: value => { seconds = value; }, source: value => { source = value; } };
}

test("focus queue invokes browser fetch with the global receiver, not the queue instance", async () => {
  const f = fixture({ enforceBrowserReceiver: true });
  const { FocusEventQueue } = f.load("focusEvents");
  const queue = new FocusEventQueue(undefined, async () => {});
  queue.enqueue(10, { eventId: "receiver-test", eventType: "focus_lost",
    occurredAt: "2026-09-20T12:00:10", durationSeconds: 10 });
  await queue.flush();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "/api/reading-histories/10/focus-events");
});

test("quiz submission waits for the Python barrier and Backend recording acknowledgement", async () => {
  const f = fixture();
  await f.load("quiz").submitQuiz({ quizId: 5, readingHistoryId: 10, selectedAnswer: "O" });
  assert.deepEqual(f.calls.filter(c => c.body).map(c => c.body.action || c.url), ["sync", "flush", "/api/quizzes/5/submit"]);
});

test("failed focus flush prevents next-part from overtaking pending confirmation", async () => {
  const f = fixture({ rejectFlush: true });
  await assert.rejects(f.load("reading").getNextReadingPart(10, 3), /pending focus/);
  assert.equal(f.calls.some(c => c.url.includes("next-part")), false);
});

test("next-part keeps the selectedLevel body unchanged after flushing", async () => {
  const f = fixture();
  await f.load("reading").getNextReadingPart(10, 3);
  assert.equal(f.calls.at(-1).url, "/api/reading-histories/10/next-part");
  assert.deepEqual(f.calls.at(-1).body, { selectedLevel: 3 });
});

test("end stops recording before Spring end, and stale heartbeat cannot restart it", async () => {
  const f = fixture();
  await f.load("reading").endReading(10);
  assert.deepEqual(f.calls.filter(c => c.body || c.url.endsWith("/end")).map(c => c.body?.action || c.url), ["stop", "/api/reading-histories/10/end"]);
  const count = f.calls.length;
  await f.load("focusSession").syncFocusSession(10, true);
  assert.equal(f.calls.length, count);
});

test("Pi camera deployment detects accidental browser-mode configuration", async () => {
  const f = fixture({ source: "browser" });
  await assert.rejects(f.load("focusSession").syncFocusSession(10, true), /camera/);
  assert.equal(f.calls.length, 1);
});

async function browserFixture() {
  const f = fixture({ source: "browser", expected: "browser" });
  await f.load("focusSession").syncFocusSession(10, true);
  const recorder = f.load("browserFocusRecording").browserFocusRecording;
  return { ...f, recorder, events: () => f.calls.filter(c => c.url.endsWith("/focus-events")),
    observe: (time, state, source = "browser") => {
      f.time(time);
      recorder.observe(state, recorder.sampleToken(), source);
    } };
}

test("browser A/G/H: short away, no session and ended session never create events", async () => {
  const f = fixture({ source: "browser", expected: "browser" });
  const recorder = f.load("browserFocusRecording").browserFocusRecording;
  recorder.observe("side", recorder.sampleToken(), "browser");
  f.time(30);
  recorder.observe("side", recorder.sampleToken(), "browser");
  assert.equal(f.calls.length, 0);
  await f.load("focusSession").syncFocusSession(10, true);
  recorder.observe("side", recorder.sampleToken(), "browser");
  f.time(35); recorder.observe("front", recorder.sampleToken(), "browser");
  f.time(36); recorder.observe("front", recorder.sampleToken(), "browser");
  await f.load("focusSession").stopFocusSession(10);
  await f.load("focusSession").syncFocusSession(10, true);
  f.time(50); recorder.observe("side", recorder.sampleToken(), "browser");
  f.time(70); recorder.observe("side", recorder.sampleToken(), "browser");
  assert.equal(f.calls.filter(c => c.url.endsWith("/focus-events")).length, 0);
});

test("browser B/C/D/E/J: one mixed away interval, stable recovery, new episode; no Python recording controls", async () => {
  const f = await browserFixture();
  f.observe(0, "side"); f.observe(10, "side");
  f.observe(20, "back"); f.observe(29, "absent");
  f.observe(30, "front"); f.observe(31, "front");
  f.observe(40, "side"); f.observe(50, "side");
  await f.load("focusSession").flushFocusEvents(10);
  const bodies = f.events().map(c => c.body);
  assert.equal(bodies.length, 3);
  assert.equal(bodies[0].eventType, "focus_lost");
  assert.equal(bodies[0].durationSeconds, 10);
  assert.equal(bodies[1].eventType, "focus_recovered");
  assert.equal(bodies[1].durationSeconds, 30);
  assert.equal(bodies[1].eventId, bodies[0].eventId);
  assert.notEqual(bodies[2].eventId, bodies[0].eventId);
  assert.equal(Date.parse(bodies[1].occurredAt) - Date.parse(bodies[0].occurredAt), 20_000);
  assert.deepEqual(Object.keys(bodies[0]).sort(), ["durationSeconds", "eventId", "eventType", "occurredAt"]);
  assert.equal(f.calls.some(c => c.url.endsWith("/focus/session")), false);
});

test("one FRONT frame cannot split the episode; stale mode/frame cannot record", async () => {
  const f = await browserFixture();
  f.observe(0, "side"); f.observe(10, "side");
  f.observe(12, "front"); f.observe(12.3, "side"); f.observe(30, "back");
  f.observe(31, "front", "camera"); f.observe(32, "front", "camera");
  const stale = f.recorder.sampleToken();
  f.recorder.observationStopped();
  f.recorder.observe("front", stale, "browser");
  await f.load("focusSession").flushFocusEvents(10);
  assert.equal(f.events().length, 1);
});

test("camera I: browser observations cannot generate Spring events", async () => {
  const f = fixture();
  await f.load("focusSession").syncFocusSession(10, true);
  const recorder = f.load("browserFocusRecording").browserFocusRecording;
  recorder.observe("side", recorder.sampleToken(), "browser");
  f.time(30); recorder.observe("side", recorder.sampleToken(), "browser");
  assert.equal(f.calls.some(c => c.url.endsWith("/focus-events")), false);
  assert.equal(f.calls.filter(c => c.body?.action === "sync").length, 1);
});

test("browser queue F: retry keeps body/ID and recovery waits for confirmation; duplicate acknowledgement accepted", async () => {
  const f = fixture();
  const { FocusEventQueue } = f.load("focusEvents");
  const calls = [], delays = [];
  const queue = new FocusEventQueue(async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body });
    if (calls.length === 1) throw new Error("network disconnected after server commit");
    return { ok: true, json: async () => ({ success: true, data: {
      status: body.eventType === "focus_lost" ? "ALREADY_PROCESSED" : "RECOVERED"
    } }) };
  }, async ms => { delays.push(ms); });
  const body = { eventId: "A", eventType: "focus_lost", durationSeconds: 10, occurredAt: "2026-09-20T12:00:10" };
  queue.enqueue(10, body);
  queue.enqueue(10, { ...body, eventType: "focus_recovered", durationSeconds: 30, occurredAt: "2026-09-20T12:00:30" });
  await queue.flush();
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(delays, [1000]);
  assert.equal(calls[2].body.eventType, "focus_recovered");
  assert.equal(calls[2].body.eventId, "A");
});

test("browser queue bounds retries, retains failed body for explicit flush and rejects permanent 4xx", async () => {
  const { FocusEventQueue } = fixture().load("focusEvents");
  let failure = true;
  const calls = [], delays = [];
  const queue = new FocusEventQueue(async (url, init) => {
    calls.push(init.body);
    return { ok: !failure, status: failure ? 503 : 200,
      json: async () => ({ success: !failure, data: { status: "SAVED" } }) };
  }, async ms => { delays.push(ms); });
  queue.enqueue(10, { eventId: "A", eventType: "focus_lost", durationSeconds: 10, occurredAt: "2026-09-20T12:00:10" });
  await assert.rejects(queue.flush(), /503/);
  assert.deepEqual(delays, [1000, 2000, 4000]);
  failure = false;
  await queue.flush();
  assert.equal(calls.length, 5);
  assert.equal(new Set(calls).size, 1);
  let attempts = 0;
  const denied = new FocusEventQueue(async () => { attempts++; return { ok: false, status: 400, json: async () => ({}) }; }, async () => {});
  denied.enqueue(10, { eventId: "B" });
  await assert.rejects(denied.flush(), /400/);
  assert.equal(attempts, 1);
});

test("browser stop closes one open event before end API and ignores later samples", async () => {
  const f = await browserFixture();
  f.observe(0, "side"); f.observe(10, "side"); f.observe(30, "side");
  await f.load("reading").endReading(10);
  assert.equal(f.events().length, 2);
  assert.equal(f.events()[1].body.durationSeconds, 30);
  assert.equal(f.calls.at(-1).url, "/api/reading-histories/10/end");
  f.observe(50, "side"); f.observe(60, "side");
  assert.equal(f.events().length, 2);
});

test("browser timezone matches Spring LocalDateTime; missing config fails before recording", async () => {
  const f = fixture();
  const { BrowserFocusRecording } = f.load("browserFocusRecording");
  const events = [];
  let now = 0;
  const recorder = new BrowserFocusRecording({ enqueue: (id, body) => events.push(body), flush: async () => {} },
    () => now, () => Date.parse("2026-09-20T00:00:00Z"), () => "A");
  await assert.rejects(recorder.sync(10, true, undefined), /FOCUS_TIME_ZONE/);
  await recorder.sync(10, true, "Asia/Seoul");
  recorder.observe("side", recorder.sampleToken(), "browser");
  now = 10; recorder.observe("side", recorder.sampleToken(), "browser");
  assert.equal(events[0].occurredAt, "2026-09-20T09:00:10");
});

test("additive monitor branch preserves 15-second character trigger alongside 10-second recording", async () => {
  const f = await browserFixture();
  const monitor = new (f.load("focusInteraction").BrowserFocusMonitor)();
  const token = () => f.recorder.sampleToken();
  f.time(0); monitor.handleState("side", token, "browser");
  f.time(10); monitor.handleState("side", token, "browser");
  assert.equal(f.calls.filter(c => c.url.endsWith("/focus") && c.body.eventType === "focus_lost").length, 0);
  f.time(15); monitor.handleState("side", token, "browser");
  f.time(30); monitor.handleState("side", token, "browser");
  await f.load("focusSession").flushFocusEvents(10);
  assert.equal(f.events().length, 1);
  const signals = f.calls.filter(c => c.url.endsWith("/focus") && c.body.eventType === "focus_lost");
  assert.equal(signals.length, 1);
  assert.equal(signals[0].body.detail, "distracted_for=15.0s");
  assert.equal(signals[0].body.source, "story-reading-browser");
});

test("an unobserved route gap cannot complete a short episode", async () => {
  const f = await browserFixture();
  f.observe(0, "side"); f.observe(5, "side");
  f.recorder.observationStopped();
  f.observe(30, "side"); f.observe(35, "side");
  await f.load("focusSession").flushFocusEvents(10);
  assert.equal(f.events().length, 0);
});

test("browser pending confirmation is acknowledged before quiz and next-part; failure prevents advancement", async () => {
  for (const endpoint of ["quiz", "next-part"]) {
    let release;
    const f = fixture({ source: "browser", expected: "browser", focusResponder: () => new Promise(resolve => { release = resolve; }) });
    const session = f.load("focusSession");
    const recorder = f.load("browserFocusRecording").browserFocusRecording;
    await session.syncFocusSession(10, true);
    recorder.observe("side", recorder.sampleToken(), "browser");
    f.time(10); recorder.observe("side", recorder.sampleToken(), "browser");
    const next = endpoint === "quiz"
      ? f.load("quiz").submitQuiz({ quizId: 5, readingHistoryId: 10, selectedAnswer: "O" })
      : f.load("reading").getNextReadingPart(10, 3);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.some(c => /submit|next-part/.test(c.url)), false);
    release({ ok: true, json: async () => ({ success: true, data: { status: "SAVED" } }) });
    await next;
    assert.match(f.calls.at(-1).url, /submit|next-part/);
  }
  const f = fixture({ source: "browser", expected: "browser", focusResponder: async () => ({ ok: false, status: 400, json: async () => ({}) }) });
  await f.load("focusSession").syncFocusSession(10, true);
  const r = f.load("browserFocusRecording").browserFocusRecording;
  r.observe("side", r.sampleToken(), "browser");
  f.time(10); r.observe("side", r.sampleToken(), "browser");
  await assert.rejects(f.load("reading").getNextReadingPart(10, 3), /400/);
  assert.equal(f.calls.some(c => c.url.endsWith("next-part")), false);
});

test("mode change fails closed and an obsolete route sync cannot reactivate recording", async () => {
  const f = fixture({ source: "browser", expected: "" });
  const session = f.load("focusSession");
  const r = f.load("browserFocusRecording").browserFocusRecording;
  await session.syncFocusSession(10, true);
  f.source("camera");
  await assert.rejects(session.syncFocusSession(10, true), /모드가 변경/);
  assert.equal(r.sampleToken(), null);
  assert.equal(f.calls.some(c => c.url.endsWith("/focus/session")), false);
  f.source("browser");
  const oldSync = session.syncFocusSession(10, true);
  const pause = session.flushFocusEvents(10);
  await Promise.all([oldSync, pause]);
  assert.equal(r.sampleToken(), null);
});

test("Node browser config disables Python backend recording even when fed an event", () => {
  const { AppConfig } = require("../../AI/realtimeinteraction/app/lib/AppConfig");
  const { FocusRecording } = require("../../AI/realtimeinteraction/app/lib/FocusRecording");
  const config = new AppConfig({ FOCUS_SOURCE: "browser", CAMERA_FOCUS: "1" }, path.resolve(__dirname, "../../AI/realtimeinteraction/app"));
  assert.equal(config.cameraFocusEnabled, false);
  const sent = [];
  const recording = new FocusRecording({ enabled: config.cameraFocusEnabled, sender: { enqueue: (...args) => sent.push(args) } });
  recording.historyId = 10;
  recording.handleLine('FOCUS_EVENT {"readingHistoryId":10,"payload":{"eventId":"A","eventType":"focus_lost","durationSeconds":10}}');
  assert.equal(sent.length, 0);
});
