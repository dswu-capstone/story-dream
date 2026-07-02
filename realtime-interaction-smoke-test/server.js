const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_DIR = path.join(__dirname, "public");
const sseClients = new Set();
let latestFocusSignal = null;

const DEFAULT_CONFIG = {
  childName: "민준",
  characterName: "토끼",
  pointOfView: "narrator",
  voice: "marin",
  model: "gpt-realtime-2",
  threshold: 0.5,
  prefixPaddingMs: 300,
  silenceDurationMs: 700,
  noResponseTimeoutMs: 10000,
  paragraph:
    "토끼는 친구들과 숨바꼭질을 하다가 꽃밭에서 넘어졌어요. 그런데도 토끼는 크게 웃었답니다. 왜냐하면 넘어진 자리에서 아주 예쁜 네잎클로버를 발견했기 때문이에요."
};

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
          `너는 동화 속 주인공 ${config.characterName}이다.`,
          `${config.characterName}의 1인칭 시점으로 말하되, 아이가 헷갈리지 않게 현재 문단 내용에만 근거해 질문해라.`
        ]
      : [
          `너는 동화 속 캐릭터 ${config.characterName}다.`,
          `3인칭 화법으로 자연스럽게 말하고, 스스로를 ${config.characterName}(이)라고 불러도 괜찮다.`
        ];

  return [
    ...narratorMode,
    `아이 이름은 ${config.childName}이다. 답변을 시작할 때 가끔 ${config.childName}의 이름을 불러라.`,
    "역할: 현재 문단을 바탕으로 아이에게 짧고 쉬운 한국어 질문을 던지는 상호작용 캐릭터.",
    "중요: 첫 응답에서는 문단 요약을 길게 하지 말고, 한 문장 질문만 말하라.",
    "아이가 대답하면 칭찬을 한 뒤, 현재 문단 내용에 기대어 한두 문장으로 아주 짧게 반응하라.",
    "아이 대답이 없거나 잘 들리지 않으면 부드럽게 다시 유도하라.",
    "항상 한국어로만 말하라.",
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
          create_response: true,
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

  if (req.method === "GET") {
    serveStatic(req, res, url.pathname);
    return;
  }

  sendText(res, 405, "Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Realtime interaction smoke test running at http://localhost:${PORT}`);
});
