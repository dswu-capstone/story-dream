const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ source = "camera", rejectFlush = false } = {}) {
  const calls = [];
  const fakeFetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.endsWith("/session") && !init?.body) {
      return { ok: true, json: async () => ({ ok: true, focus: { source } }) };
    }
    if (url.endsWith("/focus/session")) {
      return { ok: !(rejectFlush && body.action === "flush"), json: async () => ({
        ok: !(rejectFlush && body.action === "flush"), enabled: true, error: "pending focus event"
      }) };
    }
    return { ok: true, json: async () => ({ success: true, data: {} }) };
  };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    if (name === "realtimeInteraction") return { realtimeInteractionApiBase: "/interaction-api" };
    const source = fs.readFileSync(path.join(__dirname, "../src/api", `${name}.ts`), "utf8")
      .replaceAll("import.meta.env", '({ VITE_FOCUS_SOURCE: "camera" })');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    cache[name] = exports;
    vm.runInNewContext(code, { exports, require: p => load(p.replace("./", "")), fetch: fakeFetch,
      AbortSignal, console, localStorage: { getItem: () => "test-token" } });
    return exports;
  }
  return { calls, load };
}

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
