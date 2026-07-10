const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INTERACTION_MODEL = process.env.INTERACTION_MODEL || "gpt-4.1-mini";
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "";
const BACKEND_BEARER_TOKEN = process.env.BACKEND_BEARER_TOKEN || "";
const BACKEND_STORY_ID = Number(process.env.BACKEND_STORY_ID || 0);
const BACKEND_LEVEL = Number(process.env.BACKEND_LEVEL || 1);
const BACKEND_CHILD_ID = Number(process.env.BACKEND_CHILD_ID || 0);
const PUBLIC_DIR = path.join(__dirname, "public");
const sseClients = new Set();
let latestFocusSignal = null;

const MOCK_STORY = {
  storyId: "mock-rabbit-forest",
  title: "반짝이는 숲길",
  parts: [
    {
      id: "part-1",
      order: 1,
      type: "beginning",
      paragraph:
        "토끼 토토는 아침 일찍 숲길을 걷다가 반짝이는 작은 돌을 발견했어요. 토토는 그 돌이 어디에서 왔는지 궁금해졌어요."
    },
    {
      id: "part-2",
      order: 2,
      type: "middle",
      paragraph:
        "토토는 돌을 따라가다가 작은 시냇가를 만났어요. 시냇물 아래에는 반짝이는 조약돌이 여러 개 숨어 있었어요."
    },
    {
      id: "part-3",
      order: 3,
      type: "ending",
      paragraph:
        "토토는 가장 예쁜 조약돌 하나를 골라 친구에게 보여 주었어요. 친구는 함께 보물을 찾은 것 같다며 활짝 웃었어요."
    }
  ]
};

const DEFAULT_CONFIG = {
  childName: "민수",
  characterName: "토토",
  pointOfView: "narrator",
  voice: "marin",
  model: "gpt-realtime-2",
  threshold: 0.5,
  prefixPaddingMs: 300,
  silenceDurationMs: 700,
  noResponseTimeoutMs: 10000,
  paragraph: MOCK_STORY.parts[0].paragraph,
  mockStory: MOCK_STORY,
  backend: {
    baseUrl: BACKEND_BASE_URL,
    hasToken: Boolean(BACKEND_BEARER_TOKEN),
    storyId: BACKEND_STORY_ID,
    level: BACKEND_LEVEL,
    childId: BACKEND_CHILD_ID
  }
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index < 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
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

function sendSse(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastSse(eventName, data) {
  latestFocusSignal = eventName === "focus" ? data : latestFocusSignal;
  for (const client of sseClients) {
    sendSse(client, eventName, data);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function buildInstructions(config) {
  const narratorMode =
    config.pointOfView === "character"
      ? [
          `너는 동화 속 주인공 ${config.characterName}다.`,
          `${config.characterName}의 1인칭 시점으로 짧고 또렷하게 말한다.`
        ]
      : [
          `너는 동화 상호작용 캐릭터 ${config.characterName}다.`,
          `${config.characterName}라는 이름을 유지하면서 다정하고 짧게 말한다.`
        ];

  return [
    ...narratorMode,
    `아이 이름은 ${config.childName}이다.`,
    "역할: 우리가 별도로 준 문장만 또렷하고 짧게 읽는다.",
    "중요: 새로운 질문을 만들지 말고 설명을 길게 덧붙이지 말라.",
    "중요: 아이가 말한 뒤에는 자동으로 응답하지 않는다. 다음 턴은 클라이언트가 직접 보낸다.",
    `현재 문단: ${config.paragraph}`
  ].join("\n");
}

function buildSessionPayload(config) {
  return {
    type: "realtime",
    model: config.model,
    instructions: buildInstructions(config),
    output_modalities: ["audio"],
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: { model: "gpt-4o-mini-transcribe", language: "ko" },
        turn_detection: {
          type: "server_vad",
          create_response: false,
          interrupt_response: true,
          threshold: config.threshold,
          prefix_padding_ms: config.prefixPaddingMs,
          silence_duration_ms: config.silenceDurationMs
        }
      },
      output: {
        voice: config.voice,
        speed: 1.0
      }
    }
  };
}

function getOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const textBlocks = [];
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (content?.type === "output_text" && content?.text) {
        textBlocks.push(content.text);
      }
    }
  }

  return textBlocks.join("\n").trim();
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model did not return JSON");
  }

  return JSON.parse(match[0]);
}

function ensureBackendConfig(baseUrl, token) {
  if (!baseUrl) {
    throw new Error("BACKEND_BASE_URL is not configured");
  }

  if (!token) {
    throw new Error("BACKEND_BEARER_TOKEN is not configured");
  }
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

async function fetchBackendJson({ baseUrl, token, pathname, method = "GET", body }) {
  ensureBackendConfig(baseUrl, token);

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok || json.success === false) {
    throw new Error(json.message || json.error || `Backend request failed with status ${response.status}`);
  }

  return json;
}

function mapStoryDetailToClientStory(storyDetail) {
  return {
    storyId: storyDetail.originalStoryId,
    storyLevelId: storyDetail.storyLevelId,
    title: storyDetail.title,
    level: storyDetail.level,
    parts: (storyDetail.parts || []).map((part, index) => ({
      id: `story-part-${index + 1}`,
      order: part.orderNum,
      type: part.type,
      sentenceCount: (part.sentences || []).length,
      paragraph: (part.sentences || []).map((sentence) => sentence.content).join(" ").trim(),
      sentences: (part.sentences || []).map((sentence) => ({
        sentenceIdx: sentence.sentenceIdx,
        content: sentence.content
      }))
    }))
  };
}

async function createRealtimeCall(sdp, config) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const session = buildSessionPayload(config);
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(session));

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: form
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json?.error?.message || text;
    } catch {}
    throw new Error(message || `Realtime call failed with status ${response.status}`);
  }

  return {
    sdp: text,
    session
  };
}

async function requestStructuredOutput(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: INTERACTION_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ]
    })
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json?.error?.message || text;
    } catch {}
    throw new Error(message || `Responses API failed with status ${response.status}`);
  }

  return parseJsonText(getOutputText(JSON.parse(text)));
}

async function createQuestionPlan({ childName, characterName, paragraphText }) {
  const systemPrompt = [
    "너는 아동용 동화 상호작용 질문 생성기다.",
    "반드시 JSON만 출력한다.",
    "질문은 한국어 한 문장으로 짧게 만든다.",
    "정답 기준 answerKey는 1~2개의 짧은 핵심 표현만 넣는다.",
    "질문은 현재 문단만 근거로 만들어야 한다."
  ].join("\n");

  const userPrompt = [
    `아이 이름: ${childName}`,
    `캐릭터 이름: ${characterName}`,
    `현재 문단: ${paragraphText}`,
    "",
    "출력 형식:",
    "{",
    '  "question": "string",',
    '  "answerKey": ["string"],',
    '  "reason": "string"',
    "}"
  ].join("\n");

  return requestStructuredOutput(systemPrompt, userPrompt);
}

async function judgeAnswer({ paragraphText, question, answerKey, childAnswer }) {
  const systemPrompt = [
    "너는 어린이 동화 상호작용 채점기다.",
    "반드시 JSON만 출력한다.",
    "의미가 맞으면 correct=true, 아니면 false다.",
    "아이의 표현이 조금 달라도 핵심 의미가 맞으면 정답 처리한다.",
    "reason은 한 문장으로 짧게 쓴다."
  ].join("\n");

  const userPrompt = [
    `현재 문단: ${paragraphText}`,
    `질문: ${question}`,
    `정답 기준: ${(answerKey || []).join(", ")}`,
    `아이 답변: ${childAnswer}`,
    "",
    "출력 형식:",
    "{",
    '  "correct": true,',
    '  "reason": "string"',
    "}"
  ].join("\n");

  return requestStructuredOutput(systemPrompt, userPrompt);
}

function buildFeedback({ correct, answerKey }) {
  if (correct) {
    return "맞아~ 정답이야! 그럼 다음 내용을 넘어가볼까?";
  }

  const answer = Array.isArray(answerKey) && answerKey.length > 0 ? answerKey[0] : "이 문단의 핵심 내용";
  return `앗 정답은 ${answer}야 우리 같이 내용을 더 살펴보자 !`;
}

function buildFixedFeedback({ correct, answerKey }) {
  if (correct) {
    return "맞아~ 정답이야! 그럼 다음 내용을 넘어가볼까?";
  }

  const answer =
    Array.isArray(answerKey) && answerKey.length > 0
      ? answerKey[0]
      : "이 문단의 핵심 내용";
  return `앗 정답은 ${answer}야 우리 같이 내용을 더 살펴보자 !`;
}

function buildRequestedFeedback({ correct, answerKey }) {
  if (correct) {
    return "맞아~ 정답이야! 그럼 다음 내용을 넘어가볼까?";
  }

  const answer =
    Array.isArray(answerKey) && answerKey.length > 0
      ? answerKey[0]
      : "이 문단의 핵심 내용";
  return `앗 정답은 ${answer}야 우리 같이 내용을 더 살펴보자 !`;
}

function buildAppliedFeedback({ correct, answerKey }) {
  if (correct) {
    return "맞아~ 정답이야! 그럼 다음 내용을 넘어가볼까?";
  }

  const answer =
    Array.isArray(answerKey) && answerKey.length > 0
      ? answerKey[0]
      : "이 문단의 핵심 내용";
  return `앗 정답은 ${answer}야 우리 같이 내용을 더 살펴보자 !`;
}

async function handleCall(req, res) {
  try {
    const rawBody = await readBody(req);
    const incoming = rawBody ? JSON.parse(rawBody) : {};
    const config = {
      ...DEFAULT_CONFIG,
      ...(incoming.config || {})
    };

    if (!incoming.sdp) {
      sendJson(res, 400, {
        ok: false,
        error: "Missing SDP offer"
      });
      return;
    }

    const data = await createRealtimeCall(incoming.sdp, config);
    sendJson(res, 200, {
      ok: true,
      ...data
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

function handleEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive"
  });
  res.write("\n");

  sseClients.add(res);
  sendSse(res, "connected", {
    ok: true,
    latestFocusSignal
  });

  req.on("close", () => {
    sseClients.delete(res);
  });
}

async function handleFocusSignal(req, res) {
  try {
    const rawBody = await readBody(req);
    const incoming = rawBody ? JSON.parse(rawBody) : {};
    const signal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType: incoming.eventType || "focus_state",
      state: incoming.state || "unknown",
      source: incoming.source || "raspberry-pi",
      detail: incoming.detail || "",
      storyPaused: Boolean(incoming.storyPaused),
      timestamp: incoming.timestamp || new Date().toISOString()
    };

    broadcastSse("focus", signal);
    sendJson(res, 200, {
      ok: true,
      signal
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

async function handleQuestionPlan(req, res) {
  try {
    const rawBody = await readBody(req);
    const incoming = rawBody ? JSON.parse(rawBody) : {};
    const plan = await createQuestionPlan({
      childName: incoming.childName || DEFAULT_CONFIG.childName,
      characterName: incoming.characterName || DEFAULT_CONFIG.characterName,
      paragraphText: incoming.paragraphText || DEFAULT_CONFIG.paragraph
    });

    sendJson(res, 200, {
      ok: true,
      plan
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

async function handleJudgeAnswer(req, res) {
  try {
    const rawBody = await readBody(req);
    const incoming = rawBody ? JSON.parse(rawBody) : {};
    const result = await judgeAnswer({
      paragraphText: incoming.paragraphText || DEFAULT_CONFIG.paragraph,
      question: incoming.question || "",
      answerKey: incoming.answerKey || [],
      childAnswer: incoming.childAnswer || ""
    });

    sendJson(res, 200, {
      ok: true,
      result: {
        correct: Boolean(result.correct),
        reason: result.reason || ""
      },
      feedbackText: buildAppliedFeedback({
        correct: Boolean(result.correct),
        answerKey: incoming.answerKey || []
      })
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

async function handleBackendStory(req, res, url) {
  try {
    const baseUrl = url.searchParams.get("baseUrl") || BACKEND_BASE_URL;
    const token = url.searchParams.get("token") || BACKEND_BEARER_TOKEN;
    const originalStoryId = Number(url.searchParams.get("storyId") || BACKEND_STORY_ID);
    const level = Number(url.searchParams.get("level") || BACKEND_LEVEL || 1);

    if (!originalStoryId) {
      throw new Error("storyId is required");
    }

    const backendResponse = await fetchBackendJson({
      baseUrl,
      token,
      pathname: `/api/stories/${originalStoryId}?level=${level}`
    });

    sendJson(res, 200, {
      ok: true,
      story: mapStoryDetailToClientStory(backendResponse.data),
      raw: backendResponse.data
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

async function handleReadingStart(req, res) {
  try {
    const rawBody = await readBody(req);
    const incoming = rawBody ? JSON.parse(rawBody) : {};
    const baseUrl = incoming.baseUrl || BACKEND_BASE_URL;
    const token = incoming.token || BACKEND_BEARER_TOKEN;
    const childId = Number(incoming.childId || BACKEND_CHILD_ID);
    const originalStoryId = Number(incoming.storyId || BACKEND_STORY_ID);

    if (!childId || !originalStoryId) {
      throw new Error("childId and storyId are required");
    }

    const backendResponse = await fetchBackendJson({
      baseUrl,
      token,
      pathname: "/api/reading-histories/start",
      method: "POST",
      body: {
        childId,
        originalStoryId
      }
    });

    sendJson(res, 200, {
      ok: true,
      readingHistoryId: backendResponse.data?.readingHistoryId ?? null
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

async function handleReadingEnd(req, res) {
  try {
    const rawBody = await readBody(req);
    const incoming = rawBody ? JSON.parse(rawBody) : {};
    const baseUrl = incoming.baseUrl || BACKEND_BASE_URL;
    const token = incoming.token || BACKEND_BEARER_TOKEN;
    const readingHistoryId = Number(incoming.readingHistoryId || 0);

    if (!readingHistoryId) {
      throw new Error("readingHistoryId is required");
    }

    await fetchBackendJson({
      baseUrl,
      token,
      pathname: `/api/reading-histories/${readingHistoryId}/end`,
      method: "PATCH"
    });

    sendJson(res, 200, {
      ok: true
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/defaults") {
    sendJson(res, 200, DEFAULT_CONFIG);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/mock-story") {
    sendJson(res, 200, {
      ok: true,
      story: MOCK_STORY
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/backend/story") {
    await handleBackendStory(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    handleEvents(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/focus/latest") {
    sendJson(res, 200, {
      ok: true,
      signal: latestFocusSignal
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/call") {
    await handleCall(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/focus") {
    await handleFocusSignal(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/interaction/question") {
    await handleQuestionPlan(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/interaction/judge") {
    await handleJudgeAnswer(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/backend/reading/start") {
    await handleReadingStart(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/backend/reading/end") {
    await handleReadingEnd(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res, url.pathname);
    return;
  }

  sendText(res, 405, "Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Realtime interaction smoke test running at http://localhost:${PORT}`);
});
