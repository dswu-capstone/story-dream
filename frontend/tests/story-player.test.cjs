const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loader(globals = {}, mocks = {}) {
  const cache = {};
  return function load(name) {
    if (cache[name]) return cache[name];
    const source = fs.readFileSync(path.join(__dirname, "../src/utils", `${name}.ts`), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = cache[name] = {};
    vm.runInNewContext(code, { exports, console, ...globals,
      require: (p) => mocks[p] ?? load(p.replace("./", "")),
    });
    return exports;
  };
}

function audioFixture() {
  const instances = [], timers = new Map(), statuses = [];
  let sequence = 0, advances = 0, starts = 0, releases = 0;
  class Audio {
    currentTime = 0;
    paused = true;
    playCalls = 0;
    constructor() { instances.push(this); }
    set src(value) { this.source = value; this.currentTime = 0; }
    get src() { return this.source; }
    pause() { this.paused = true; }
    removeAttribute() { this.source = ""; }
    load() { this.currentTime = 0; }
    play() { this.paused = false; this.playCalls++; return this.playResult?.() ?? Promise.resolve(); }
  }
  const { StoryAudioPlayer } = loader({ Audio, DOMException,
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  })("storyAudioPlayer");
  const player = new StoryAudioPlayer({ onStatus: (s) => statuses.push(s), onEnded: () => advances++,
    onStart: () => starts++, onRelease: () => releases++, onPlaying: () => {},
  });
  const run = (ms) => { for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } };
  return { player, instances, statuses, run, timers, stats: () => ({ advances, starts, releases }) };
}

test("autoplay advances once, reuses one element and resets only on page changes", () => {
  const f = audioFixture();
  f.player.setPage("page-1");
  const audio = f.instances[0];
  assert.equal(audio.playCalls, 1);
  audio.onplaying();
  audio.currentTime = 4;
  for (let i = 0; i < 3; i++) { f.player.toggle(); assert.equal(audio.currentTime, 4); f.player.toggle(); }
  assert.equal(audio.currentTime, 4);
  audio.onended(); f.run(80); f.run(80);
  assert.equal(f.stats().advances, 1);
  f.player.setPage("page-2");
  assert.equal(audio.currentTime, 0);
  assert.equal(f.instances.length, 1);
});

test("pause at ended boundary cancels queued advancement; resume advances once", () => {
  const f = audioFixture(); f.player.setPage("page-1");
  f.instances[0].onended(); f.player.toggle(); f.run(80);
  assert.equal(f.stats().advances, 0);
  f.player.toggle(); assert.equal(f.stats().advances, 1);
});

test("rapid navigation, late ended and late rejected play cannot alter the new page", async () => {
  const f = audioFixture(); const audio = f.instances[0];
  let reject;
  audio.playResult = () => new Promise((_, r) => { reject = r; });
  f.player.setPage("old"); const oldEnded = audio.onended;
  audio.playResult = null;
  for (let i = 0; i < 10; i++) f.player.setPage(`page-${i}`);
  oldEnded(); reject(new Error("obsolete")); await Promise.resolve(); f.run(80);
  assert.equal(audio.src, "page-9"); assert.equal(f.stats().advances, 0);
  assert.notEqual(f.statuses.at(-1), "error");
});

test("blocked autoplay resumes after a gesture; missing, failed and timed out audio never skip", async () => {
  const f = audioFixture(); const audio = f.instances[0];
  audio.playResult = () => Promise.reject(new DOMException("gesture", "NotAllowedError"));
  f.player.setPage("blocked"); await Promise.resolve();
  assert.equal(f.statuses.at(-1), "blocked");
  audio.playResult = null; f.player.toggle(); audio.onplaying();
  assert.equal(f.statuses.at(-1), "playing");
  audio.onerror(); assert.equal(f.statuses.at(-1), "error");
  f.player.toggle(); f.run(20000); assert.equal(f.statuses.at(-1), "error");
  f.player.setPage(null); assert.equal(f.stats().advances, 0);
});

test("stop clears listeners, timers and pending ended on unmount/focus navigation", () => {
  const f = audioFixture(); f.player.setPage("one"); f.instances[0].onended();
  f.player.stop(); f.run(80);
  assert.equal(f.stats().advances, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.instances[0].onended, null); assert.equal(f.instances[0].paused, true);
});

function sessionFixture() {
  let stored = null, starts = 0, advances = 0, failDetail = false;
  const part = (order, count, level = 1) => ({ type: `part-${order}`, orderNum: order,
    pages: Array.from({ length: count }, (_, i) => ({ pageId: order * 100 + level * 10 + i, pageNum: i + 1, audioUrl: `${order}-${level}-${i}`, sentences: [] })),
  });
  const parts = [part(1, 4), part(2, 4), part(3, 4)];
  const load = loader({
    sessionStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; }, removeItem: () => { stored = null; } },
    window: { dispatchEvent() {} }, Event,
  }, {
    "../api/reading": {
      startReading: async () => { starts++; return { readingHistoryId: starts, level: 1, partType: "part-1", partOrderNum: 1, pages: parts[0].pages }; },
      getNextReadingPart: async (_, level) => { advances++; return { level, partType: "part-2", partOrderNum: 2, pages: part(2, 3, level).pages }; },
    },
    "../api/story": { getStoryDetail: async () => { if (failDetail) throw new Error("detail unavailable"); return { parts }; } },
  });
  return { ...load("readingSession"), ...load("readingFlow"), part,
    stats: () => ({ starts, advances }), fail: (value) => { failDetail = value; },
    request: { key: "new-1", originalStoryId: 1, childId: 1, storyTitle: "Test", startNewSession: true, advanceToNextPart: false },
  };
}

test("Strict Mode/retry shares start mutation and resets quiz history for a new session", async () => {
  const f = sessionFixture(); f.fail(true);
  await Promise.allSettled([f.initializeReadingSession(f.request), f.initializeReadingSession(f.request)]);
  f.fail(false); let session = await f.initializeReadingSession(f.request);
  assert.equal(f.stats().starts, 1);
  session.quizzesByPart = { 1: { completed: true, results: {} } }; f.saveReadingSession(session);
  session = await f.initializeReadingSession({ ...f.request, key: "new-2" });
  assert.equal(f.stats().starts, 2); assert.equal(Object.keys(session.quizzesByPart).length, 0);
});

test("quiz completion requires every successful answer; results stay immutable and session scoped", async () => {
  const f = sessionFixture(); let session = await f.initializeReadingSession(f.request);
  const result = { readingHistoryId: 1, partOrderNum: 1, lastQuizOfPart: true, selectedAnswer: "A" };
  session = f.recordReadingQuiz(session, 2, [1, 2], result);
  assert.equal(session.quizzesByPart[1].completed, false);
  session = f.recordReadingQuiz(session, 1, [1, 2], { ...result, lastQuizOfPart: false });
  assert.equal(session.quizzesByPart[1].completed, true);
  session = f.recordReadingQuiz(session, 2, [1, 2], { ...result, selectedAnswer: "B" });
  assert.equal(session.quizzesByPart[1].results[2].selectedAnswer, "A");
  assert.equal(f.recordReadingQuiz(session, 3, [3], { ...result, readingHistoryId: 999 }), session);
});

test("different part levels remain cached; locked seeking clamps; revisits never call next-part", async () => {
  const f = sessionFixture(); let session = await f.initializeReadingSession(f.request);
  assert.equal(f.selectReadingPage(session, 12).currentPageIndex, 3);
  session.quizzesByPart = { 1: { completed: true, results: {} } }; f.saveReadingSession(session);
  const nextRequest = { ...f.request, startNewSession: false, advanceToNextPart: true, fromPartOrderNum: 1, selectedLevel: 3 };
  await Promise.all([f.initializeReadingSession(nextRequest), f.initializeReadingSession(nextRequest)]);
  session = f.loadReadingSession();
  assert.equal(f.stats().advances, 1); assert.equal(session.selectedLevel, 3);
  assert.equal(session.pageProgress.totalPages, 11);
  session = f.selectReadingPage(session, 2); f.saveReadingSession(session);
  assert.equal(session.selectedLevel, 1); assert.equal(session.currentPart.pages[0].audioUrl, "1-1-0");
  session = await f.initializeReadingSession(nextRequest);
  assert.equal(session.selectedLevel, 3); assert.equal(session.currentPageIndex, 0);
  assert.equal(f.stats().advances, 1);
  session = f.selectReadingPage(session, 12);
  assert.equal(session.pageProgress.currentPage, 7);
});

test("a failed detail GET after next-part cannot advance the server a second time", async () => {
  const f = sessionFixture(); const session = await f.initializeReadingSession(f.request);
  session.quizzesByPart = { 1: { completed: true, results: {} } }; f.saveReadingSession(session);
  const request = { ...f.request, startNewSession: false, advanceToNextPart: true, fromPartOrderNum: 1 };
  f.fail(true); await assert.rejects(f.initializeReadingSession(request));
  f.fail(false); await f.initializeReadingSession(request);
  assert.equal(f.stats().advances, 1);
});
