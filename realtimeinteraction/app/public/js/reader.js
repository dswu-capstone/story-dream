/**
 * ReaderScreen — 동화 리더 + 집중 감지 퀴즈 사이클.
 *
 * 화면 오른쪽/왼쪽 터치로 페이지를 넘기고, 페이지마다 사전 생성된
 * 나레이션(/assets/audio/<bookId>/levelN/page-XXX.wav)을 재생한다.
 *
 * 퀴즈 사이클 (camera_focus.py가 focus_lost/absent를 보내면):
 *   나레이션 정지(위치 기억) → Realtime에 JSON {question, emotion} 요청
 *   → 감정별 캐릭터 이미지 + 질문 발화 → 아이 대답 대기
 *   → 무응답: 매번 다른 "집중하자" 멘트 반복(최대 maxReminders회)
 *   → 대답: JSON {correct, feedback, emotion} 판정 → /api/quiz-log 기록
 *   → 캐릭터 퇴장, 멈춘 지점부터 나레이션 재개.
 *
 * RealtimeClient — OpenAI Realtime WebRTC 연결 래퍼 (SDP는 서버가 프록시).
 */

import { DreamyCharacter } from "./dreamy.js";
import { BrowserFocus } from "./browser_focus.js";

// Realtime 이 고르는 감정 태그(한국어 "주석") -> dreamy 에셋 이름
const EMOTION_MAP = {
  "기쁨": "happy",
  "슬픔": "sad",
  "화남": "angry",
  "놀람": "surprise",
  "생각": "happy",
  "무서움": "surprise",
  happy: "happy",
  sad: "sad",
  angry: "angry",
  surprise: "surprise",
  scared: "surprise"
};
function toDreamyEmotion(tag) {
  return EMOTION_MAP[(tag || "").trim()] || "happy";
}

// ---------------------------------------------------------------- realtime --

export class RealtimeClient {
  constructor(api, handlers) {
    this.api = api;
    this.handlers = handlers; // {onEvent, onConnectionChange}
    this.pc = null;
    this.dataChannel = null;
    this.localStream = null;
    this.connected = false;
    this.connecting = false;
    this.expected = null; // 진행 중인 response.create의 태그
    this.audioEl = document.querySelector("#characterAudio");
    this.audioCtx = null;
    this.analyser = null; // 원격 오디오 음량 분석(립싱크용)
  }

  /** 원격 오디오 스트림에 AnalyserNode 를 물려 실시간 음량을 읽을 수 있게 한다. */
  attachAnalyser(remoteStream) {
    try {
      this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
      const src = this.audioCtx.createMediaStreamSource(remoteStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.5;
      src.connect(this.analyser); // destination 에는 연결하지 않음(오디오는 audioEl 이 재생)
    } catch (error) {
      console.log("[realtime] analyser attach failed:", error.message);
      this.analyser = null;
    }
  }

  async connect() {
    if (this.connected || this.connecting) return;
    this.connecting = true;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const pc = new RTCPeerConnection();
      const remote = new MediaStream();
      this.audioEl.srcObject = remote;
      pc.ontrack = (event) => {
        remote.addTrack(event.track);
        this.attachAnalyser(remote);
      };
      for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream);

      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (event) => this.handlers.onEvent(JSON.parse(event.data));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const data = await this.api.call(offer.sdp);
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          this.teardown();
        }
      };

      this.pc = pc;
      this.dataChannel = dc;
      this.connected = true;
      this.handlers.onConnectionChange(true);
      console.log("[realtime] connected");
    } catch (error) {
      console.log("[realtime] connect failed:", error.message);
      this.teardown();
    } finally {
      this.connecting = false;
    }
  }

  teardown() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.pc) {
      this.pc.getSenders().forEach((s) => s.track && s.track.stop());
      this.pc.close();
    }
    if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop());
    this.pc = null;
    this.dataChannel = null;
    this.localStream = null;
    const wasConnected = this.connected;
    this.connected = false;
    this.expected = null;
    if (wasConnected) this.handlers.onConnectionChange(false);
    // 네트워크가 잠깐 끊긴 경우 자동 복구
    setTimeout(() => this.connect(), 20000);
  }

  send(event) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("Realtime data channel is not open");
    }
    this.dataChannel.send(JSON.stringify(event));
  }

  /** 기계용 JSON 요청 (음성으로 나가지 않음) */
  requestJson(instructions, tag) {
    this.expected = tag;
    this.send({
      type: "response.create",
      response: { output_modalities: ["text"], instructions }
    });
  }

  /** 문장 하나를 그대로 발화 */
  requestSpeak(line, tag) {
    this.expected = tag;
    this.send({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: `다음 문장을 그대로 자연스럽게 말하라. 다른 말은 덧붙이지 마라: "${line}"`
      }
    });
  }

  static extractText(response) {
    let out = "";
    for (const item of response?.output || []) {
      for (const part of item.content || []) {
        if (typeof part.text === "string") out += part.text;
        else if (typeof part.transcript === "string") out += part.transcript;
      }
    }
    return out.trim();
  }

  static parseJsonLoose(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

// ------------------------------------------------------------------ reader --

export class ReaderScreen {
  constructor(app) {
    this.app = app;
    this.els = {
      title: document.querySelector("#readerTitle"),
      pageArt: document.querySelector("#pageArt"),
      pageText: document.querySelector("#pageText"),
      pageLabel: document.querySelector("#pageLabel"),
      scrub: document.querySelector("#scrub"),
      prevZone: document.querySelector("#prevZone"),
      nextZone: document.querySelector("#nextZone"),
      backBtn: document.querySelector("#backBtn"),
      levelBtns: Array.from(document.querySelectorAll(".levelBtn")),
      narration: document.querySelector("#narration"),
      sessionDot: document.querySelector("#sessionDot"),
      character: document.querySelector("#character"),
      dreamyCanvas: document.querySelector("#dreamyCanvas"),
      characterText: document.querySelector("#characterText"),
      characterHint: document.querySelector("#characterHint")
    };

    // dreamy 캐릭터 (캔버스 렌더 + 실시간 립싱크)
    this.dreamy = new DreamyCharacter(this.els.dreamyCanvas);

    // 브라우저 웹캠 집중 감지 (focus.source === "browser" 일 때만 사용)
    this.browserFocus = new BrowserFocus(app.api);

    this.view = {
      bookId: null,
      level: 1,
      page: 0,
      pageCount: 1,
      sentences: [],
      scrubbing: false,
      narrationKey: null,
      sentenceHistory: [] // [{t, texts}] 아이가 실제로 본 페이지들
    };

    this.quiz = this.freshQuizState();
    this.quiz.cooldownUntil = 0;

    // 캐릭터 음성 재생 상태 (output_audio_buffer.* 이벤트로 추적)
    this.audioPlaying = false;
    this.audioWaiters = new Set();

    this.realtime = new RealtimeClient(app.api, {
      onEvent: (msg) => this.onRealtimeEvent(msg),
      onConnectionChange: (connected) => {
        this.els.sessionDot.classList.toggle("connected", connected);
        if (!connected && this.quiz.active) this.endQuiz("connection_lost");
      }
    });

    this.bindInputs();
  }

  freshQuizState() {
    return {
      active: false,
      phase: "idle", // ask-json | await-answer | listening | judging | reminder | closing
      question: "",
      emotion: "happy",
      answer: "",
      reminders: 0,
      reminderLines: [],
      recentText: "",
      trigger: null,
      savedTime: 0,
      answerTimer: null,
      cooldownUntil: this.quiz ? this.quiz.cooldownUntil : 0
    };
  }

  get config() {
    return this.app.session?.character || { childName: "아이", answerTimeoutMs: 10000, maxReminders: 6, quizCooldownMs: 20000 };
  }

  get active() {
    return this.app.current === "reader";
  }

  // ---- lifecycle ----

  /** 서재에서 책을 열어 리더로 들어올 때 */
  open(snapshot) {
    this.view.narrationKey = null;
    this.view.sentenceHistory = [];
    this.render(snapshot);
    // 책 클릭이 사용자 제스처이므로 여기서 마이크/오디오/웹캠 시작 가능
    if (this.app.session?.services?.realtime) {
      this.realtime.connect();
    }
    if (this.app.session?.focus?.source === "browser") {
      this.browserFocus.start();
    }
  }

  /** 서재로 돌아갈 때 */
  close() {
    this.els.narration.pause();
    this.browserFocus.stop();
    if (this.quiz.active) this.endQuiz("left_reader");
  }

  // ---- rendering ----

  narrationSrc(level, page) {
    const idx = String(page).padStart(3, "0");
    return `/assets/audio/${this.view.bookId}/level${level}/page-${idx}.wav`;
  }

  playNarration() {
    if (this.quiz.active) return;
    const key = `${this.view.bookId}:${this.view.level}:${this.view.page}`;
    if (key !== this.view.narrationKey) {
      this.view.narrationKey = key;
      this.els.narration.src = this.narrationSrc(this.view.level, this.view.page);
    }
    this.els.narration.currentTime = 0;
    this.els.narration.play().catch(() => {
      // 오디오 파일이 아직 없거나(생성 중) 자동재생 차단 — 다음 페이지에서 재시도
    });
  }

  render(snapshot) {
    if (!snapshot.bookId) return;
    const changedPage =
      snapshot.bookId !== this.view.bookId ||
      snapshot.level !== this.view.level ||
      snapshot.page !== this.view.page;

    this.view.bookId = snapshot.bookId;
    this.view.level = snapshot.level;
    this.view.page = snapshot.page;
    this.view.pageCount = snapshot.pageCount;
    this.view.sentences = snapshot.sentences || [];

    this.els.title.textContent = snapshot.title || "";

    this.els.pageText.innerHTML = "";
    this.view.sentences.forEach((sentence, i) => {
      const p = document.createElement("p");
      p.className = "sentence";
      p.style.animationDelay = `${i * 0.12}s`;
      p.textContent = sentence;
      this.els.pageText.appendChild(p);
    });

    // 텍스트 패널: 짝수 페이지 왼쪽 위, 홀수 페이지 오른쪽 아래
    this.els.pageText.classList.toggle("pos-tl", this.view.page % 2 === 0);
    this.els.pageText.classList.toggle("pos-br", this.view.page % 2 === 1);

    if (changedPage || this.view.sentenceHistory.length === 0) {
      this.view.sentenceHistory.push({ t: Date.now(), texts: this.view.sentences });
      if (this.view.sentenceHistory.length > 12) this.view.sentenceHistory.shift();
    }

    if (changedPage || this.view.narrationKey === null) {
      this.playNarration();
    }

    this.els.pageLabel.textContent = `${this.view.page + 1} / ${this.view.pageCount}`;
    this.els.scrub.max = String(Math.max(0, this.view.pageCount - 1));
    if (!this.view.scrubbing) this.els.scrub.value = String(this.view.page);

    this.els.levelBtns.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.level) === this.view.level);
    });
  }

  /** 최근 windowMs 동안 화면에 보였던 문장들 (퀴즈 출제 범위) */
  recentStoryText(windowMs = 30000) {
    const cutoff = Date.now() - windowMs;
    const texts = [];
    for (const entry of this.view.sentenceHistory) {
      if (entry.t >= cutoff) texts.push(...entry.texts);
    }
    if (texts.length === 0) texts.push(...this.view.sentences);
    return [...new Set(texts)].join("\n");
  }

  // ---- input ----

  bindInputs() {
    this.els.nextZone.addEventListener("click", () => this.goTo(this.view.page + 1));
    this.els.prevZone.addEventListener("click", () => this.goTo(this.view.page - 1));
    this.els.backBtn.addEventListener("click", () => this.app.backToLibrary());

    window.addEventListener("keydown", (event) => {
      if (!this.active) return;
      if (event.key === "ArrowRight" || event.key === " ") this.goTo(this.view.page + 1);
      if (event.key === "ArrowLeft") this.goTo(this.view.page - 1);
    });

    this.els.scrub.addEventListener("input", () => {
      this.view.scrubbing = true;
      this.els.pageLabel.textContent = `${Number(this.els.scrub.value) + 1} / ${this.view.pageCount}`;
    });
    this.els.scrub.addEventListener("change", () => {
      this.view.scrubbing = false;
      this.goTo(Number(this.els.scrub.value));
    });

    this.els.levelBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = Number(btn.dataset.level);
        if (level !== this.view.level) this.app.api.setState({ level, source: "display" });
      });
    });
  }

  goTo(page) {
    const clamped = Math.min(Math.max(0, page), this.view.pageCount - 1);
    if (clamped === this.view.page) return;
    this.app.api.setState({ page: clamped, source: "display" }).catch(() => {});
  }

  // ---- character overlay ----

  showCharacter({ emotion, text, hint }) {
    if (emotion !== undefined) this.dreamy.setEmotion(toDreamyEmotion(emotion));
    if (text !== undefined) this.els.characterText.textContent = text;
    if (hint !== undefined) this.els.characterHint.textContent = hint;
    // realtime 오디오 분석기를 dreamy 립싱크에 연결하고 애니메이션 시작
    if (this.realtime.analyser) this.dreamy.attachAnalyser(this.realtime.analyser);
    this.els.character.classList.remove("hidden");
    this.dreamy.ready.then(() => this.dreamy.start());
  }

  hideCharacter() {
    this.els.character.classList.add("hidden");
    this.dreamy.stop();
  }

  /**
   * 캐릭터가 실제로 말을 끝낼 때까지 기다린다.
   * response.done(생성 완료)은 오디오 재생보다 먼저 온다. 그래서 문장 중간의
   * 짧은 무음이 아니라, WebRTC 가 주는 실제 재생 종료 이벤트
   * (output_audio_buffer.stopped)를 기다려 말이 잘리지 않게 한다.
   */
  waitForSpeechEnd({ timeoutMs = 30000, startGraceMs = 1200 } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        this.audioWaiters.delete(done);
        clearTimeout(timer);
        clearTimeout(graceTimer);
        resolve();
      };
      // 재생 종료(stopped) 이벤트가 오면 깨어난다
      this.audioWaiters.add(done);
      const timer = setTimeout(done, timeoutMs);
      // 재생이 아직 시작 안 했으면, 잠깐 기다렸다가 그래도 안 시작하면 종료로 간주
      let graceTimer = null;
      if (!this.audioPlaying) {
        graceTimer = setTimeout(() => {
          if (!this.audioPlaying) done();
        }, startGraceMs);
      }
    });
  }

  // ---- quiz cycle ----

  onFocusSignal(signal) {
    if (!this.active || !signal) return;
    if (!["focus_lost", "absent"].includes(signal.eventType)) return;
    if (!this.realtime.connected || this.quiz.active) return;
    if (Date.now() < this.quiz.cooldownUntil) return;
    this.startQuiz(signal);
  }

  startQuiz(signal) {
    const cooldown = this.quiz.cooldownUntil;
    this.quiz = this.freshQuizState();
    this.quiz.cooldownUntil = cooldown;
    this.quiz.active = true;
    this.quiz.phase = "ask-json";
    this.quiz.trigger = signal;
    this.quiz.recentText = this.recentStoryText();

    this.quiz.savedTime = this.els.narration.currentTime || 0;
    this.els.narration.pause();
    // 퀴즈 동안엔 웹캠 감지를 멈춰(산만 시간 누적 방지) 끝나자마자 다시 묻지 않게 한다
    this.browserFocus.pause();

    this.showCharacter({ emotion: "happy", text: "", hint: "잠깐! 나 할 말이 있어…" });
    console.log("[quiz] started:", signal.eventType);

    const absentNote =
      signal.eventType === "absent"
        ? "아이가 자리를 비운 것 같으니 먼저 돌아오라고 부드럽게 부른 뒤 질문하는 문장으로 만들어라."
        : "";

    this.safeRequest(() =>
      this.realtime.requestJson(
        [
          "JSON으로만 답하라.",
          "아이가 방금까지 들은 동화 내용:",
          this.quiz.recentText,
          "",
          `이 내용에서 ${this.config.childName}(유치원생)이 바로 답할 수 있는 아주 쉬운 퀴즈 한 문제를 한 문장으로 만들어라.`,
          absentNote,
          "동시에, 이 질문을 할 때 캐릭터가 어떤 표정이면 좋을지 감정을 기쁨 / 슬픔 / 화남 / 놀람 중 하나로 골라라. (이 감정은 캐릭터 얼굴을 고르는 '주석'일 뿐, 절대 소리 내어 말하지 않는다.)",
          '형식: {"question": "한 문장 질문", "emotion": "기쁨|슬픔|화남|놀람"}'
        ]
          .filter(Boolean)
          .join("\n"),
        "quiz-json"
      )
    );
  }

  safeRequest(fn) {
    try {
      fn();
    } catch (error) {
      console.log("[quiz] request failed:", error.message);
      this.endQuiz("send_failed");
    }
  }

  startAnswerTimer() {
    clearTimeout(this.quiz.answerTimer);
    this.quiz.answerTimer = setTimeout(() => this.onAnswerTimeout(), this.config.answerTimeoutMs);
  }

  clearAnswerTimer() {
    clearTimeout(this.quiz.answerTimer);
    this.quiz.answerTimer = null;
  }

  onAnswerTimeout() {
    if (!this.quiz.active || this.quiz.phase !== "await-answer") return;
    this.quiz.reminders += 1;

    if (this.quiz.reminders > this.config.maxReminders) {
      // 끝내 대답이 없으면 기록하고 이야기로 복귀 ("closing"은 늦은 대답 무시용)
      this.quiz.phase = "closing";
      this.app.api.quizLog({
        question: this.quiz.question,
        answer: null,
        correct: null,
        result: "no_answer",
        attempts: this.quiz.reminders - 1,
        trigger: this.quiz.trigger?.eventType
      });
      this.safeRequest(() =>
        this.realtime.requestSpeak(`${this.config.childName}, 그럼 이야기를 계속 들어보자!`, "speak-feedback")
      );
      return;
    }

    this.quiz.phase = "reminder";
    const used = this.quiz.reminderLines.length
      ? `지금까지 쓴 표현: ${this.quiz.reminderLines.join(" / ")}`
      : "";
    this.safeRequest(() =>
      this.realtime.requestJson(
        [
          "JSON으로만 답하라.",
          `아이(${this.config.childName})가 아직 퀴즈에 대답하지 않았다.`,
          "아이의 이름을 부르며 '집중하자, 대답해 보자'는 뜻을 담은 짧은 한 문장을 만들어라.",
          "매번 다른 표현을 써라. 가끔은 '렛츠 포커스!'처럼 다른 나라 말을 살짝 섞어도 좋다.",
          used,
          "동시에 캐릭터의 감정을 기쁨 / 슬픔 / 화남 / 놀람 중 하나로 골라라. (감정은 얼굴을 고르는 주석일 뿐, 소리 내어 말하지 않는다.)",
          '형식: {"line": "한 문장", "emotion": "기쁨|슬픔|화남|놀람"}'
        ]
          .filter(Boolean)
          .join("\n"),
        "reminder-json"
      )
    );
  }

  onChildAnswer(transcript) {
    this.clearAnswerTimer();
    this.quiz.phase = "judging";
    this.quiz.answer = transcript;
    this.showCharacter({ hint: "음… 생각해 볼게!" });

    this.safeRequest(() =>
      this.realtime.requestJson(
        [
          "JSON으로만 답하라.",
          `퀴즈: ${this.quiz.question}`,
          `아이의 대답: ${this.quiz.answer}`,
          "동화 내용:",
          this.quiz.recentText,
          "",
          "아이의 대답이 정답인지 판단하라. 발음이 어눌하거나 표현이 달라도 뜻이 맞으면 정답이다.",
          'feedback은 캐릭터가 아이에게 말할 한두 문장이다: 맞으면 "맞았어!"로 시작해 칭찬하고, 틀리면 "아니야"로 시작해 정답을 알려준다. 마지막은 "이제 다시 이야기에 집중하자" 같은 말로 끝낸다.',
          "동시에 캐릭터의 감정을 기쁨 / 슬픔 / 화남 / 놀람 중 하나로 골라라. (감정은 얼굴을 고르는 주석일 뿐, 소리 내어 말하지 않는다.)",
          '형식: {"correct": true, "feedback": "...", "emotion": "기쁨|슬픔|화남|놀람"}'
        ].join("\n"),
        "judge-json"
      )
    );
  }

  endQuiz(reason) {
    this.clearAnswerTimer();
    const savedTime = this.quiz.savedTime;
    this.quiz.active = false;
    this.quiz.phase = "idle";
    this.quiz.cooldownUntil = Date.now() + this.config.quizCooldownMs;
    console.log("[quiz] ended:", reason);

    setTimeout(() => {
      this.hideCharacter();
      if (!this.active) return;
      // 퀴즈가 끊었던 바로 그 지점부터 나레이션 재개
      this.els.narration.currentTime = savedTime;
      this.els.narration.play().catch(() => {});
    }, 600);

    // 쿨다운이 지난 뒤에야 웹캠 감지를 0부터 다시 시작 (곧바로 재질문 방지)
    setTimeout(() => {
      if (this.active) this.browserFocus.resume();
    }, this.config.quizCooldownMs);
  }

  // ---- realtime events ----

  onRealtimeEvent(message) {
    if (message.type === "error") {
      console.log("[realtime] error:", message.error);
      return;
    }

    // 캐릭터 음성 재생 시작/종료 (WebRTC output_audio_buffer.*)
    if (message.type === "output_audio_buffer.started") {
      this.audioPlaying = true;
      return;
    }
    if (
      message.type === "output_audio_buffer.stopped" ||
      message.type === "output_audio_buffer.cleared"
    ) {
      this.audioPlaying = false;
      for (const w of [...this.audioWaiters]) w();
      return;
    }

    if (message.type === "input_audio_buffer.speech_started") {
      if (this.quiz.active && this.quiz.phase === "await-answer") {
        this.quiz.phase = "listening";
        this.clearAnswerTimer();
        this.showCharacter({ hint: "듣고 있어요…" });
      }
      return;
    }

    if (message.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = (message.transcript || "").trim();
      if (this.quiz.active && ["await-answer", "listening"].includes(this.quiz.phase) && transcript) {
        console.log("[quiz] child answer:", transcript);
        this.onChildAnswer(transcript);
      }
      return;
    }

    if (message.type === "response.done") {
      const tag = this.realtime.expected;
      this.realtime.expected = null;
      const text = RealtimeClient.extractText(message.response);
      this.onResponseDone(tag, text);
    }
  }

  onResponseDone(tag, text) {
    if (!this.quiz.active) return;

    switch (tag) {
      case "quiz-json": {
        const data = RealtimeClient.parseJsonLoose(text) || {};
        this.quiz.question =
          data.question || `${this.config.childName}, 방금 이야기에서 무슨 일이 있었지?`;
        this.quiz.emotion = data.emotion || "happy";
        // 감정은 음성으로 내보내지 않고 이미지 분기/로그에만 사용
        this.showCharacter({ emotion: this.quiz.emotion, text: this.quiz.question, hint: "" });
        this.safeRequest(() => this.realtime.requestSpeak(this.quiz.question, "speak-question"));
        break;
      }

      case "speak-question":
      case "speak-reminder": {
        // 발화가 실제로 끝난 뒤에 대답 대기로 넘어간다 (말이 잘리지 않게)
        this.waitForSpeechEnd().then(() => {
          if (!this.quiz.active) return;
          this.quiz.phase = "await-answer";
          this.showCharacter({ hint: "🎤 대답해 볼까?" });
          this.startAnswerTimer();
        });
        break;
      }

      case "reminder-json": {
        const data = RealtimeClient.parseJsonLoose(text) || {};
        const line = data.line || `${this.config.childName}, 우리 집중하자!`;
        this.quiz.reminderLines.push(line);
        this.showCharacter({ emotion: data.emotion || "sad", text: line, hint: "" });
        this.safeRequest(() => this.realtime.requestSpeak(line, "speak-reminder"));
        break;
      }

      case "judge-json": {
        const data = RealtimeClient.parseJsonLoose(text) || {};
        const correct = Boolean(data.correct);
        const feedback =
          data.feedback ||
          (correct ? "맞았어! 이제 다시 이야기에 집중하자." : "아니야, 다시 이야기를 잘 들어보자!");
        const emotion = data.emotion || (correct ? "happy" : "sad");

        this.app.api.quizLog({
          question: this.quiz.question,
          answer: this.quiz.answer,
          correct,
          emotion,
          feedback,
          attempts: this.quiz.reminders,
          trigger: this.quiz.trigger?.eventType
        });

        this.showCharacter({ emotion, text: feedback, hint: "" });
        this.safeRequest(() => this.realtime.requestSpeak(feedback, "speak-feedback"));
        break;
      }

      case "speak-feedback": {
        // 마무리 멘트를 끝까지 말한 뒤에 캐릭터를 내리고 나레이션을 재개한다
        this.waitForSpeechEnd().then(() => this.endQuiz("cycle_complete"));
        break;
      }

      default:
        break;
    }
  }
}
