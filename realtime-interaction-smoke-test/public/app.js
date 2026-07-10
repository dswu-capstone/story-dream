const els = {
  connectButton: document.querySelector("#connectButton"),
  startButton: document.querySelector("#startButton"),
  fallbackButton: document.querySelector("#fallbackButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  previousPartButton: document.querySelector("#previousPartButton"),
  nextPartButton: document.querySelector("#nextPartButton"),
  loadStoryButton: document.querySelector("#loadStoryButton"),
  startReadingButton: document.querySelector("#startReadingButton"),
  endReadingButton: document.querySelector("#endReadingButton"),
  focusSignal: document.querySelector("#focusSignal"),
  storySource: document.querySelector("#storySource"),
  readingSession: document.querySelector("#readingSession"),
  remoteAudio: document.querySelector("#remoteAudio"),
  log: document.querySelector("#log"),
  statusList: document.querySelector("#statusList"),
  childName: document.querySelector("#childName"),
  characterName: document.querySelector("#characterName"),
  paragraph: document.querySelector("#paragraph"),
  backendBaseUrl: document.querySelector("#backendBaseUrl"),
  backendToken: document.querySelector("#backendToken"),
  backendStoryId: document.querySelector("#backendStoryId"),
  backendLevel: document.querySelector("#backendLevel"),
  backendChildId: document.querySelector("#backendChildId"),
  model: document.querySelector("#model"),
  voice: document.querySelector("#voice"),
  threshold: document.querySelector("#threshold"),
  prefixPaddingMs: document.querySelector("#prefixPaddingMs"),
  silenceDurationMs: document.querySelector("#silenceDurationMs"),
  noResponseTimeoutMs: document.querySelector("#noResponseTimeoutMs")
};

const state = {
  pc: null,
  dataChannel: null,
  localStream: null,
  connected: false,
  noResponseTimer: null,
  focusEvents: null,
  lastFocusSignalId: null,
  storySource: "mock",
  story: null,
  currentPartIndex: 0,
  readingHistoryId: null,
  stage: "idle",
  currentPlan: null,
  currentQuestionText: "",
  latestChildTranscript: "",
  awaitingJudge: false,
  activeTurnPartIndex: null
};

function log(message, payload) {
  const stamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  const extra = payload ? ` ${JSON.stringify(payload, null, 2)}` : "";
  els.log.textContent = `[${stamp}] ${message}${extra}\n${els.log.textContent}`;
}

window.addEventListener("error", (event) => {
  log("window error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event.reason instanceof Error
      ? { name: event.reason.name, message: event.reason.message, stack: event.reason.stack }
      : event.reason;
  log("unhandled rejection", reason);
});

function renderStatus(items) {
  els.statusList.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    els.statusList.appendChild(li);
  }
}

function renderFocusSignal(signal) {
  if (!signal) {
    els.focusSignal.textContent = "YOLO signal: waiting";
    return;
  }

  const stamp = signal.timestamp
    ? new Date(signal.timestamp).toLocaleTimeString("ko-KR", { hour12: false })
    : "--:--:--";
  els.focusSignal.textContent = `YOLO signal: ${signal.eventType} / ${signal.state} @ ${stamp}`;
}

function renderStorySource() {
  const part = getCurrentPart();
  const storyTitle = state.story?.title || "unknown";
  const sourceLabel = state.storySource === "backend" ? "backend story" : "mock story";
  const partLabel = part ? `${part.order}` : "-";
  els.storySource.textContent = `Story source: ${sourceLabel} / ${storyTitle} / part ${partLabel}`;
}

function renderReadingSession() {
  els.readingSession.textContent = state.readingHistoryId
    ? `Reading session: ${state.readingHistoryId}`
    : "Reading session: not started";
}

function setConnectedUi(connected) {
  els.connectButton.disabled = connected;
  els.startButton.disabled = !connected;
  els.fallbackButton.disabled = !connected;
  els.disconnectButton.disabled = !connected;
}

function describeConnectError(error) {
  if (!error) {
    return "Unknown connection error";
  }

  if (error.name === "NotAllowedError" || /permission denied/i.test(error.message)) {
    return "Microphone permission is blocked in the browser or Windows.";
  }

  if (error.name === "NotFoundError") {
    return "No available microphone device was found.";
  }

  if (error.name === "NotReadableError") {
    return "The microphone is in use by another app or could not be opened.";
  }

  if (error.name === "AbortError") {
    return "The microphone request was aborted.";
  }

  if (error.name === "SecurityError") {
    return "Security settings blocked microphone access.";
  }

  return error.message || String(error);
}

function summarizeError(error) {
  return {
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  };
}

function getConfig() {
  return {
    childName: els.childName.value.trim(),
    characterName: els.characterName.value.trim(),
    paragraph: els.paragraph.value.trim(),
    pointOfView: "narrator",
    model: els.model.value.trim(),
    voice: els.voice.value.trim(),
    threshold: Number(els.threshold.value),
    prefixPaddingMs: Number(els.prefixPaddingMs.value),
    silenceDurationMs: Number(els.silenceDurationMs.value),
    noResponseTimeoutMs: Number(els.noResponseTimeoutMs.value)
  };
}

function getBackendConfig() {
  return {
    baseUrl: els.backendBaseUrl.value.trim(),
    token: els.backendToken.value.trim(),
    storyId: Number(els.backendStoryId.value || 0),
    level: Number(els.backendLevel.value || 1),
    childId: Number(els.backendChildId.value || 0)
  };
}

function getCurrentPart() {
  return state.story?.parts?.[state.currentPartIndex] || null;
}

function updateParagraphFromPart() {
  const part = getCurrentPart();
  if (!part) {
    return;
  }

  els.paragraph.value = part.paragraph;
  renderStorySource();
}

function applyStory(story, source) {
  state.story = story;
  state.storySource = source;
  state.currentPartIndex = 0;
  updateParagraphFromPart();
}

function getActiveTurnParagraph() {
  if (
    state.activeTurnPartIndex !== null &&
    state.story?.parts?.[state.activeTurnPartIndex]?.paragraph
  ) {
    return state.story.parts[state.activeTurnPartIndex].paragraph;
  }

  return els.paragraph.value.trim();
}

function movePart(offset) {
  if (!state.story?.parts?.length) {
    return;
  }

  const nextIndex = state.currentPartIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.story.parts.length) {
    return;
  }

  state.currentPartIndex = nextIndex;
  updateParagraphFromPart();
  renderStatus([
    `문단 ${getCurrentPart().order}로 이동했습니다.`,
    "현재 문단 기준으로 다음 상호작용을 시작할 수 있습니다."
  ]);
}

function isInteractionLocked() {
  return !["idle", "done"].includes(state.stage);
}

function isFocusRecoveryAllowed() {
  return ["question_speaking", "waiting_child", "judging", "final_speaking"].includes(state.stage);
}

async function loadDefaults() {
  const response = await fetch("/api/defaults");
  const defaults = await response.json();

  els.childName.value = defaults.childName;
  els.characterName.value = defaults.characterName;
  els.paragraph.value = defaults.paragraph;
  els.model.value = defaults.model;
  els.voice.value = defaults.voice;
  els.threshold.value = defaults.threshold;
  els.prefixPaddingMs.value = defaults.prefixPaddingMs;
  els.silenceDurationMs.value = defaults.silenceDurationMs;
  els.noResponseTimeoutMs.value = defaults.noResponseTimeoutMs;
  els.backendBaseUrl.value = defaults.backend.baseUrl || "";
  els.backendStoryId.value = defaults.backend.storyId || "";
  els.backendLevel.value = defaults.backend.level || 1;
  els.backendChildId.value = defaults.backend.childId || "";
  if (!defaults.backend.hasToken) {
    els.backendToken.placeholder = "No backend token in .env";
  }

  applyStory(defaults.mockStory, "mock");
  renderReadingSession();
  renderStatus([
    "Mock story is ready.",
    "Connect the realtime session, then press Start Question."
  ]);
}

function startNoResponseTimer() {
  clearTimeout(state.noResponseTimer);
  state.noResponseTimer = setTimeout(() => {
    if (state.connected && state.stage === "waiting_child") {
      log("no child response detected, sending fallback");
      requestFallbackResponse();
    }
  }, getConfig().noResponseTimeoutMs);
}

function clearNoResponseTimer() {
  clearTimeout(state.noResponseTimer);
  state.noResponseTimer = null;
}

function sendEvent(event) {
  if (!state.dataChannel || state.dataChannel.readyState !== "open") {
    throw new Error("Data channel is not open");
  }
  state.dataChannel.send(JSON.stringify(event));
  log(`client -> ${event.type}`, event);
}

async function fetchQuestionPlan() {
  const config = getConfig();
  const response = await fetch("/api/interaction/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      childName: config.childName,
      characterName: config.characterName,
      paragraphText: config.paragraph
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "question plan generation failed");
  }

  return data.plan;
}

async function fetchJudgeResult(childAnswer) {
  const response = await fetch("/api/interaction/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paragraphText: getActiveTurnParagraph(),
      question: state.currentPlan?.question || "",
      answerKey: state.currentPlan?.answerKey || [],
      childAnswer
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "answer judging failed");
  }

  return data;
}

async function loadBackendStory() {
  const backend = getBackendConfig();
  const query = new URLSearchParams({
    baseUrl: backend.baseUrl,
    token: backend.token,
    storyId: String(backend.storyId),
    level: String(backend.level)
  });

  const response = await fetch(`/api/backend/story?${query.toString()}`);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "backend story load failed");
  }

  applyStory(data.story, "backend");
  renderStatus([
    `${data.story.title} loaded from backend.`,
    "The first part is now selected."
  ]);
  log("backend story loaded", data.story);
}

async function startReadingSession() {
  const backend = getBackendConfig();
  const response = await fetch("/api/backend/reading/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: backend.baseUrl,
      token: backend.token,
      storyId: backend.storyId,
      childId: backend.childId
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "reading start failed");
  }

  state.readingHistoryId = data.readingHistoryId;
  renderReadingSession();
}

async function endReadingSession() {
  if (!state.readingHistoryId) {
    throw new Error("readingHistoryId is missing");
  }

  const backend = getBackendConfig();
  const response = await fetch("/api/backend/reading/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: backend.baseUrl,
      token: backend.token,
      readingHistoryId: state.readingHistoryId
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "reading end failed");
  }

  state.readingHistoryId = null;
  renderReadingSession();
}

function requestSpeechLine(line) {
  sendEvent({
    type: "response.create",
    response: {
      conversation: "auto",
      instructions: [
        "Read only the following sentence naturally in Korean.",
        "Do not add any extra explanation.",
        `Sentence: ${line}`
      ].join("\n"),
      audio: {
        output: {
          voice: getConfig().voice
        }
      }
    }
  });
}

async function startInteraction() {
  if (!state.connected) {
    throw new Error("Realtime session is not connected");
  }

  const part = getCurrentPart();
  if (!part) {
    renderStatus([
      "No story part is ready.",
      "Load the mock story or backend story first."
    ]);
    return;
  }

  state.stage = "question_planning";
  state.latestChildTranscript = "";
  state.awaitingJudge = false;
  state.activeTurnPartIndex = state.currentPartIndex;

  renderStatus([
    `Preparing a question for part ${part.order}.`,
    "Generating question and answer key from the current paragraph."
  ]);

  const plan = await fetchQuestionPlan();
  state.currentPlan = {
    ...plan,
    paragraphText: part.paragraph,
    partIndex: state.currentPartIndex
  };
  state.currentQuestionText = plan.question;
  state.stage = "question_speaking";

  log("question plan created", plan);
  requestSpeechLine(plan.question);
}

async function judgeLatestAnswer() {
  if (state.awaitingJudge || state.stage !== "waiting_child") {
    return;
  }

  const childAnswer = state.latestChildTranscript.trim();
  if (!childAnswer) {
    return;
  }

  state.awaitingJudge = true;
  state.stage = "judging";
  clearNoResponseTimer();

  const data = await fetchJudgeResult(childAnswer);
  state.currentPlan = {
    ...state.currentPlan,
    lastJudgeCorrect: Boolean(data.result.correct),
    lastJudgeEvaluated: true
  };
  state.stage = "final_speaking";
  log("judge result", data);
  requestSpeechLine(data.feedbackText);
}

function requestFallbackResponse() {
  clearNoResponseTimer();
  state.stage = "final_speaking";
  requestSpeechLine("아직 답이 없네. 우리 같이 다시 생각해보자!");
}

function advanceStoryPart() {
  if (!state.story?.parts?.length) {
    return;
  }

  if (state.currentPartIndex < state.story.parts.length - 1) {
    state.currentPartIndex += 1;
    updateParagraphFromPart();
  }
}

function disconnect() {
  clearNoResponseTimer();

  if (state.dataChannel) {
    state.dataChannel.close();
  }
  if (state.pc) {
    state.pc.getSenders().forEach((sender) => sender.track && sender.track.stop());
    state.pc.close();
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }

  state.pc = null;
  state.dataChannel = null;
  state.localStream = null;
  state.connected = false;
  state.lastFocusSignalId = null;
  state.currentPlan = null;
  state.currentQuestionText = "";
  state.latestChildTranscript = "";
  state.awaitingJudge = false;
  state.activeTurnPartIndex = null;
  state.stage = "idle";
  setConnectedUi(false);
  renderFocusSignal(null);
}

function requestFocusRecoveryPrompt(signal) {
  const part = getCurrentPart();
  const line = [
    `${getConfig().childName}, 우리 다시 이야기로 돌아가 보자.`,
    part ? `지금 문단은 ${part.paragraph}` : "",
    signal.detail ? `상황 메모: ${signal.detail}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  requestSpeechLine(line);
}

function handleFocusSignal(signal) {
  if (!signal || signal.id === state.lastFocusSignalId) {
    return;
  }
  state.lastFocusSignalId = signal.id;
  renderFocusSignal(signal);
  log("focus signal received", signal);

  if (signal.eventType === "focus_lost" && state.connected && isFocusRecoveryAllowed()) {
    requestFocusRecoveryPrompt(signal);
  }
}

function subscribeFocusEvents() {
  const focusEvents = new EventSource("/api/events");
  focusEvents.addEventListener("connected", (event) => {
    const message = JSON.parse(event.data);
    log("focus event stream connected", message);
    if (message.latestFocusSignal) {
      renderFocusSignal(message.latestFocusSignal);
    }
  });
  focusEvents.addEventListener("focus", (event) => {
    handleFocusSignal(JSON.parse(event.data));
  });
  focusEvents.onerror = () => {
    log("focus event stream disconnected");
  };
  state.focusEvents = focusEvents;
}

async function connect() {
  const config = getConfig();
  renderStatus([
    "Preparing the realtime session.",
    "Requesting microphone access."
  ]);

  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  const pc = new RTCPeerConnection();
  const remoteAudioStream = new MediaStream();
  els.remoteAudio.srcObject = remoteAudioStream;

  pc.ontrack = (event) => {
    remoteAudioStream.addTrack(event.track);
    log("remote audio track received");
  };

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  const dataChannel = pc.createDataChannel("oai-events");
  dataChannel.onopen = () => {
    log("data channel open");
    renderStatus([
      "Realtime session connected.",
      "Press Start Question to begin the 3-turn interaction."
    ]);
  };
  dataChannel.onmessage = (event) => {
    handleServerEvent(JSON.parse(event.data));
  };
  dataChannel.onerror = (event) => {
    log("data channel error", event);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const response = await fetch("/api/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sdp: offer.sdp,
      config
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "WebRTC SDP exchange failed");
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp: data.sdp
  });

  pc.onconnectionstatechange = () => {
    log("peer connection state", { state: pc.connectionState });
  };
  pc.oniceconnectionstatechange = () => {
    log("ice connection state", { state: pc.iceConnectionState });
  };

  state.pc = pc;
  state.dataChannel = dataChannel;
  state.localStream = localStream;
  state.connected = true;
  setConnectedUi(true);
}

function handleResponseDone() {
  if (state.stage === "question_speaking") {
    state.stage = "waiting_child";
    startNoResponseTimer();
    renderStatus([
      "Question playback finished.",
      state.currentQuestionText ? `Question: ${state.currentQuestionText}` : "No question text.",
      "Waiting for the child's answer."
    ]);
    return;
  }

  if (state.stage === "final_speaking") {
    const lastJudgeWasCorrect = state.currentPlan?.lastJudgeCorrect;
    const lastJudgeWasEvaluated = state.currentPlan?.lastJudgeEvaluated;
    if (lastJudgeWasEvaluated) {
      advanceStoryPart();
    }

    state.stage = "done";
    state.currentPlan = null;
    state.currentQuestionText = "";
    state.latestChildTranscript = "";
    state.awaitingJudge = false;
    state.activeTurnPartIndex = null;

    const completionStatus = lastJudgeWasEvaluated
      ? lastJudgeWasCorrect
        ? "Moved to the next part after a correct answer."
        : "Moved to the next part after an incorrect answer."
      : "Finished this turn without a spoken answer.";

    renderStatus([
      "3-turn interaction completed.",
      completionStatus
    ]);
  }
}

function handleServerEvent(message) {
  log(`server -> ${message.type}`, message);

  if (message.type === "conversation.item.input_audio_transcription.completed") {
    state.latestChildTranscript = message.transcript || "";
    judgeLatestAnswer().catch((error) => {
      log("judge failed", summarizeError(error));
      state.stage = "done";
      state.awaitingJudge = false;
    });
  }

  if (message.type === "response.done") {
    handleResponseDone();
  }
}

els.connectButton.addEventListener("click", async () => {
  log("connect button clicked");
  try {
    await connect();
  } catch (error) {
    log("connect failed", summarizeError(error));
    renderStatus([
      "Connection failed.",
      describeConnectError(error)
    ]);
    disconnect();
  }
});

els.startButton.addEventListener("click", () => {
  log("start button clicked");
  startInteraction().catch((error) => {
    log("start failed", summarizeError(error));
    state.stage = "done";
  });
});

els.fallbackButton.addEventListener("click", () => {
  log("fallback button clicked");
  try {
    requestFallbackResponse();
  } catch (error) {
    log("fallback failed", summarizeError(error));
  }
});

els.disconnectButton.addEventListener("click", () => {
  log("disconnect button clicked");
  disconnect();
});

els.previousPartButton.addEventListener("click", () => {
  if (isInteractionLocked()) {
    return;
  }
  movePart(-1);
});

els.nextPartButton.addEventListener("click", () => {
  if (isInteractionLocked()) {
    return;
  }
  movePart(1);
});

els.loadStoryButton.addEventListener("click", () => {
  if (isInteractionLocked()) {
    return;
  }
  loadBackendStory().catch((error) => {
    log("backend story load failed", summarizeError(error));
  });
});

els.startReadingButton.addEventListener("click", () => {
  startReadingSession().catch((error) => {
    log("reading start failed", summarizeError(error));
  });
});

els.endReadingButton.addEventListener("click", () => {
  endReadingSession().catch((error) => {
    log("reading end failed", summarizeError(error));
  });
});

loadDefaults().catch((error) => {
  log("failed to load defaults", summarizeError(error));
});

subscribeFocusEvents();
log("app initialized");
