/**
 * Story Dream 통합 서버
 *
 * 한 프로세스가 전체 흐름을 담당한다:
 *   목소리 등록 → 서재(책 목록) → 나레이션 생성(버퍼링) → 리더(+집중 감지 퀴즈)
 *
 * 실제 로직은 lib/ 의 서비스 클래스들에 있고, 이 파일은 조립(부트스트랩)과
 * HTTP 라우팅만 한다. 웹서버/DB 연동 시 각 클래스(StoryRepository,
 * VoiceProfileStore, QuizLogStore, NarrationService)를 DB 구현으로 교체한다.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const { AppConfig } = require("./lib/AppConfig");
const { SseHub } = require("./lib/SseHub");
const { StoryRepository } = require("./lib/StoryRepository");
const { VoiceProfileStore } = require("./lib/VoiceProfileStore");
const { NarrationService } = require("./lib/NarrationService");
const { ReadingSession } = require("./lib/ReadingSession");
const { RealtimeGateway } = require("./lib/RealtimeGateway");
const { FocusMonitor } = require("./lib/FocusMonitor");
const { PoseWorker } = require("./lib/PoseWorker");
const { QuizLogStore } = require("./lib/QuizLogStore");

// ---- bootstrap -------------------------------------------------------------

const config = new AppConfig(process.env, __dirname);
const sse = new SseHub();
const stories = new StoryRepository(config);
const voice = new VoiceProfileStore({
  recordingsDir: config.recordingsDir,
  userReferenceWav: config.userReferenceWav,
  defaultReferenceWav: config.defaultReferenceWav,
  pythonBin: config.pythonBin,
  buildScript: config.buildReferenceScript
});
const narration = new NarrationService({
  audioRoot: config.audioRoot,
  pythonBin: config.pythonBin,
  script: config.voiceCloningScript,
  fishApiKey: config.fishAudioApiKey,
  enterReadyPages: config.enterReadyPages,
  stories,
  voice,
  sse
});
const session = new ReadingSession({ stories, sse });
const realtime = new RealtimeGateway({
  apiKey: config.openaiApiKey,
  character: config.character
});
const focus = new FocusMonitor({
  enabled: config.cameraFocusEnabled,
  pythonBin: config.pythonBin,
  script: config.cameraFocusScript,
  serverPort: config.port,
  sse
});
// 브라우저 웹캠 모드에서만 상주 YOLO 워커를 띄운다.
const poseWorker =
  config.focusSource === "browser"
    ? new PoseWorker({ pythonBin: config.pythonBin, script: config.poseWorkerScript })
    : null;
const quizLog = new QuizLogStore({ file: config.quizLogFile });

// ---- http helpers ----------------------------------------------------------

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text)
  });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readBinaryBody(req, maxBytes = 30_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) reject(new Error("Body too large"));
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg"
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(config.publicDir, path.normalize(safePath));
  if (!filePath.startsWith(config.publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  serveFile(res, filePath);
}

// ---- api handlers ------------------------------------------------------------

/** 부팅 시 프론트가 화면 흐름을 결정하는 데 필요한 모든 것 */
function handleSession(res) {
  sendJson(res, 200, {
    ok: true,
    voice: voice.status(),
    reading: session.snapshot(),
    character: config.character,
    services: {
      realtime: realtime.available,
      narration: Boolean(config.fishAudioApiKey)
    },
    focus: { source: config.focusSource }
  });
}

function handleBooks(res) {
  const books = stories.list().map((story) => ({
    ...story.toJSON(),
    cover: story.coverPath ? `/covers/${story.id}` : null,
    narration: narration.status(story)
  }));
  sendJson(res, 200, { ok: true, books });
}

function withStory(res, bookId, fn) {
  const story = stories.get(bookId);
  if (!story) {
    sendJson(res, 404, { ok: false, error: `unknown book: ${bookId}` });
    return;
  }
  fn(story);
}

// ---- server -------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    // --- 세션/이벤트 ---
    if (req.method === "GET" && p === "/api/session") return handleSession(res);

    if (req.method === "GET" && p === "/api/events") {
      return sse.handle(req, res, (send) => {
        send("state", { ...session.snapshot(), source: "connected" });
        if (focus.latest) send("focus", focus.latest);
        for (const job of narration.jobs.values()) send("narration", job.toJSON());
      });
    }

    // --- 목소리 등록 ---
    if (req.method === "GET" && p === "/api/voice/prompts") {
      return sendJson(res, 200, { ok: true, prompts: voice.prompts, ...voice.status() });
    }
    if (req.method === "POST" && p === "/api/voice/recordings") {
      const index = Number(url.searchParams.get("index"));
      const body = await readBinaryBody(req);
      const saved = voice.saveRecording(index, body, req.headers["content-type"]);
      return sendJson(res, 200, { ok: true, ...saved });
    }
    if (req.method === "POST" && p === "/api/voice/reset") {
      voice.clearRecordings();
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST" && p === "/api/voice/finalize") {
      const summary = await voice.finalize();
      return sendJson(res, 200, { ok: true, ...summary, voice: voice.status() });
    }

    // --- 서재 / 책 ---
    if (req.method === "GET" && p === "/api/books") return handleBooks(res);

    let m = p.match(/^\/covers\/([^/]+)$/);
    if (req.method === "GET" && m) {
      return withStory(res, m[1], (story) => {
        if (!story.coverPath) return sendText(res, 404, "no cover");
        serveFile(res, story.coverPath);
      });
    }

    m = p.match(/^\/api\/books\/([^/]+)\/narration$/);
    if (m) {
      return withStory(res, m[1], (story) => {
        if (req.method === "POST") {
          return sendJson(res, 200, { ok: true, ...narration.start(story) });
        }
        return sendJson(res, 200, { ok: true, ...narration.status(story) });
      });
    }

    m = p.match(/^\/api\/books\/([^/]+)\/open$/);
    if (req.method === "POST" && m) {
      return withStory(res, m[1], (story) => {
        sendJson(res, 200, { ok: true, ...session.open(story.id) });
      });
    }

    // --- 리더 상태 (페이지/레벨) ---
    if (req.method === "GET" && p === "/api/state") {
      return sendJson(res, 200, { ok: true, ...session.snapshot() });
    }
    if (req.method === "POST" && p === "/api/state") {
      const body = await readJsonBody(req);
      return sendJson(res, 200, { ok: true, ...session.setState(body, body.source) });
    }
    if (req.method === "POST" && p === "/api/session/close") {
      session.close();
      return sendJson(res, 200, { ok: true });
    }

    // --- 집중 감지 / 퀴즈 로그 / Realtime ---
    if (req.method === "POST" && p === "/api/focus") {
      const body = await readJsonBody(req);
      return sendJson(res, 200, { ok: true, signal: focus.handleSignal(body) });
    }
    // 브라우저 웹캠 프레임 1장을 YOLO 로 분류 (browser 모드)
    if (req.method === "POST" && p === "/api/detect-pose") {
      if (!poseWorker) return sendJson(res, 200, { ok: true, state: "absent" });
      const body = await readJsonBody(req);
      if (!body.image) return sendJson(res, 400, { ok: false, error: "Missing image" });
      const { state } = await poseWorker.classify(body.image);
      return sendJson(res, 200, { ok: true, state });
    }
    if (req.method === "POST" && p === "/api/quiz-log") {
      const body = await readJsonBody(req);
      const snapshot = session.snapshot();
      const entry = quizLog.append(body, {
        bookId: snapshot.bookId,
        level: snapshot.level,
        page: snapshot.page
      });
      sse.broadcast("quizlog", entry);
      return sendJson(res, 200, { ok: true, entry });
    }
    if (req.method === "POST" && p === "/api/call") {
      const body = await readJsonBody(req);
      if (!body.sdp) return sendJson(res, 400, { ok: false, error: "Missing SDP offer" });
      const title = session.snapshot().title || "동화";
      const data = await realtime.createCall(body.sdp, title);
      return sendJson(res, 200, { ok: true, ...data });
    }

    // --- dreamy 캐릭터 에셋 (public 밖의 dreamy_assets 디렉터리) ---
    m = p.match(/^\/dreamy_assets\/(.+)$/);
    if (req.method === "GET" && m) {
      const filePath = path.join(config.dreamyAssetsDir, path.normalize(m[1]));
      if (!filePath.startsWith(config.dreamyAssetsDir)) {
        return sendText(res, 403, "Forbidden");
      }
      return serveFile(res, filePath);
    }

    // --- 정적 파일 ---
    if (req.method === "GET") return serveStatic(res, p);

    sendText(res, 405, "Method not allowed");
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

// ---- lifecycle -------------------------------------------------------------------

process.on("exit", () => {
  focus.stop();
  if (poseWorker) poseWorker.stop();
});
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => process.exit(0));
}

server.listen(config.port, config.host, () => {
  console.log(`storydream app running at http://${config.host}:${config.port}`);
  console.log(`books: ${stories.list().map((s) => `${s.id}(${s.title})`).join(", ") || "none"}`);
  console.log(`voice reference: ${voice.activeReference().source}`);
  if (!realtime.available) console.log("[warn] OPENAI_API_KEY not set -- quiz character disabled");
  if (!config.fishAudioApiKey) console.log("[warn] FISH_AUDIO_API_KEY not set -- narration generation disabled");
  console.log(`focus source: ${config.focusSource}`);
  focus.start();
  if (poseWorker) poseWorker.start();
});
