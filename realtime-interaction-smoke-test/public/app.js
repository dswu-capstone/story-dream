const els = {
  connectButton: document.querySelector("#connectButton"),
  startButton: document.querySelector("#startButton"),
  fallbackButton: document.querySelector("#fallbackButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  focusSignal: document.querySelector("#focusSignal"),
  remoteAudio: document.querySelector("#remoteAudio"),
  log: document.querySelector("#log"),
  statusList: document.querySelector("#statusList"),
  childName: document.querySelector("#childName"),
  characterName: document.querySelector("#characterName"),
  paragraph: document.querySelector("#paragraph"),
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
  childSpokeSincePrompt: false,
  focusEvents: null,
  lastFocusSignalId: null
};

function log(message, payload) {
  const stamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  const extra = payload ? ` ${JSON.stringify(payload, null, 2)}` : "";
  els.log.textContent = `[${stamp}] ${message}${extra}\n${els.log.textContent}`;
}

function renderStatus(items) {
  els.statusList.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    els.statusList.appendChild(li);
  }
}

function renderFocusSignal(signal) {
  if (!els.focusSignal) {
    return;
  }

  if (!signal) {
    els.focusSignal.textContent = "YOLO signal: waiting";
    return;
  }

  const stamp = signal.timestamp ? new Date(signal.timestamp).toLocaleTimeString("ko-KR", { hour12: false }) : "--:--:--";
  els.focusSignal.textContent = `YOLO signal: ${signal.eventType} / ${signal.state} @ ${stamp}`;
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

function setConnectedUi(connected) {
  els.connectButton.disabled = connected;
  els.startButton.disabled = !connected;
  els.fallbackButton.disabled = !connected;
  els.disconnectButton.disabled = !connected;
}

function describeConnectError(error) {
  if (!error) {
    return "알 수 없는 연결 오류";
  }

  if (error.name === "NotAllowedError" || /permission denied/i.test(error.message)) {
    return "브라우저 또는 Windows에서 마이크 권한이 차단되었습니다.";
  }

  if (error.name === "NotFoundError") {
    return "사용 가능한 마이크 장치를 찾지 못했습니다.";
  }

  if (error.name === "NotReadableError") {
    return "마이크를 다른 앱이 사용 중이거나 장치 접근에 실패했습니다.";
  }

  return error.message;
}

function summarizeError(error) {
  return {
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  };
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
  renderStatus([
    "연결 전",
    "문단과 이름을 확인한 뒤 세션 연결을 누르세요.",
    "질문 시작 후 10초 무응답이면 fallback 멘트를 생성합니다."
  ]);
}

function startNoResponseTimer() {
  clearTimeout(state.noResponseTimer);
  state.childSpokeSincePrompt = false;

  const { noResponseTimeoutMs } = getConfig();
  state.noResponseTimer = setTimeout(() => {
    if (state.connected && !state.childSpokeSincePrompt) {
      log("무응답 timeout 도달, fallback 응답 생성");
      requestFallbackResponse();
    }
  }, noResponseTimeoutMs);
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

function requestQuestion() {
  const { childName, characterName, paragraph } = getConfig();
  startNoResponseTimer();
  sendEvent({
    type: "response.create",
    response: {
      conversation: "auto",
      instructions: [
        `${characterName}가 ${childName}에게 먼저 말을 건다.`,
        "현재 문단만 바탕으로 한 문장 질문을 한국어로 말하라.",
        "문단을 그대로 길게 낭독하지 마라.",
        `문단: ${paragraph}`
      ].join("\n"),
      audio: {
        output: {
          voice: getConfig().voice
        }
      }
    }
  });
}

function requestFocusRecoveryPrompt(signal) {
  const { childName, characterName, paragraph, voice } = getConfig();
  startNoResponseTimer();
  sendEvent({
    type: "response.create",
    response: {
      conversation: "auto",
      instructions: [
        `${characterName}가 ${childName}의 집중이 흐트러진 것을 눈치챘다.`,
        "나레이션 톤으로 짧고 다정하게 다시 이야기에 집중하도록 말을 건다.",
        "현재 문단 내용을 바탕으로 한 문장 질문 하나만 한다.",
        "겁주거나 혼내지 말고, 바로 대답하기 쉽게 유도한다.",
        `현재 문단: ${paragraph}`,
        `감지 상태: ${signal.state}`,
        signal.detail ? `감지 상세: ${signal.detail}` : ""
      ]
        .filter(Boolean)
        .join("\n"),
      audio: {
        output: {
          voice
        }
      }
    }
  });
}

function requestFallbackResponse() {
  clearNoResponseTimer();
  sendEvent({
    type: "response.create",
    response: {
      conversation: "auto",
      instructions:
        "아이가 아직 대답하지 않았다. 한국어로 짧고 다정하게 '괜찮아, 그럼 이야기를 다시 들어보자.'와 비슷한 복귀 멘트를 말하라."
    }
  });
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
  setConnectedUi(false);
  renderFocusSignal(null);
  renderStatus([
    "연결 종료됨",
    "필요하면 다시 세션 연결 후 질문을 시작하세요."
  ]);
}

function handleFocusSignal(signal) {
  if (!signal || signal.id === state.lastFocusSignalId) {
    return;
  }

  state.lastFocusSignalId = signal.id;
  renderFocusSignal(signal);
  log("focus signal received", signal);

  if (signal.eventType === "focus_state") {
    return;
  }

  if (signal.eventType === "focus_lost") {
    renderStatus([
      "YOLO가 집중 이탈을 감지했습니다.",
      "앱 서버 신호로 캐릭터가 다시 말을 겁니다.",
      state.connected ? "Realtime 재질문을 자동 생성합니다." : "Realtime 연결 후 자동 상호작용을 테스트할 수 있습니다."
    ]);

    if (state.connected) {
      requestFocusRecoveryPrompt(signal);
    }
    return;
  }

  if (signal.eventType === "absent") {
    renderStatus([
      "YOLO가 자리 이탈을 감지했습니다.",
      signal.storyPaused ? "스토리 일시정지 상태로 전환합니다." : "자리 이탈 이벤트만 수신했습니다.",
      "복귀 후 다시 상호작용을 시작할 수 있습니다."
    ]);
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
    const signal = JSON.parse(event.data);
    handleFocusSignal(signal);
  });

  focusEvents.onerror = () => {
    log("focus event stream disconnected");
  };

  state.focusEvents = focusEvents;
}

async function connect() {
  const config = getConfig();
  renderStatus([
    "세션 준비 중",
    "로컬 마이크 권한 요청",
    "서버에서 Realtime 세션 생성 중"
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
      "연결 완료",
      "이제 질문 시작을 누르면 캐릭터가 먼저 말합니다.",
      "아이 발화 종료는 server_vad 기준으로 자동 감지됩니다."
    ]);
  };
  dataChannel.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleServerEvent(message);
  };
  dataChannel.onerror = (event) => {
    log("data channel error", event);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const response = await fetch("/api/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
      renderStatus([
        `세션 상태: ${pc.connectionState}`,
        "오른쪽 로그에서 마지막 에러를 확인하세요."
      ]);
    }
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

function handleServerEvent(message) {
  log(`server -> ${message.type}`, message);

  if (message.type === "input_audio_buffer.speech_started") {
    state.childSpokeSincePrompt = true;
    clearNoResponseTimer();
    renderStatus([
      "아이 음성 감지됨",
      "Realtime API가 발화 끝을 기다리는 중",
      "침묵 구간이 지나면 자동 응답 생성"
    ]);
  }

  if (message.type === "input_audio_buffer.speech_stopped") {
    renderStatus([
      "아이 발화 종료 감지됨",
      "모델이 응답을 생성 중입니다."
    ]);
  }

  if (message.type === "response.created") {
    renderStatus([
      "응답 생성 시작",
      "원격 음성이 곧 재생됩니다."
    ]);
  }

  if (message.type === "response.done") {
    renderStatus([
      "응답 완료",
      "다시 질문 시작을 누르거나, 자유롭게 말해 다음 턴을 확인할 수 있습니다."
    ]);
  }
}

els.connectButton.addEventListener("click", async () => {
  try {
    await connect();
  } catch (error) {
    log("connect failed", summarizeError(error));
    renderStatus([
      "연결 실패",
      describeConnectError(error),
      "서버 터미널과 오른쪽 로그를 확인하세요."
    ]);
    disconnect();
  }
});

els.startButton.addEventListener("click", () => {
  try {
    requestQuestion();
  } catch (error) {
    log("start failed", summarizeError(error));
  }
});

els.fallbackButton.addEventListener("click", () => {
  try {
    requestFallbackResponse();
  } catch (error) {
    log("fallback failed", summarizeError(error));
  }
});

els.disconnectButton.addEventListener("click", () => {
  disconnect();
});

loadDefaults().catch((error) => {
  log("failed to load defaults", summarizeError(error));
});

subscribeFocusEvents();
