/**
 * EnrollScreen — 목소리 등록 화면.
 *
 * 프롬프트를 하나씩 보여주고, 마이크 RMS로 실제 발화를 감지해
 * MediaRecorder 테이크를 만들어 업로드한다. 마지막 프롬프트가 끝나면
 * 서버가 레퍼런스 WAV를 합성하고, 완료되면 서재로 넘어간다.
 * 이미 reference_user.wav가 있으면 "넘어가기" 버튼이 보인다.
 */

const START_RMS = 0.028;
const STOP_RMS = 0.014;
const START_HOLD_MS = 200;
const SILENCE_MS = 1400;
const MIN_TAKE_MS = 900;
const MAX_TAKE_MS = 20000;

export class EnrollScreen {
  constructor(app) {
    this.app = app;
    this.els = {
      step: document.querySelector("#enrollStep"),
      card: document.querySelector("#enrollCard"),
      prompt: document.querySelector("#enrollPrompt"),
      status: document.querySelector("#enrollStatus"),
      micDot: document.querySelector("#micDot"),
      meter: document.querySelector("#meter"),
      startBtn: document.querySelector("#enrollStartBtn"),
      skipBtn: document.querySelector("#enrollSkipBtn"),
      redoBtn: document.querySelector("#enrollRedoBtn")
    };

    this.prompts = [];
    this.index = 0;
    this.stream = null;
    this.analyser = null;
    this.recorder = null;
    this.chunks = [];
    this.phase = "idle"; // idle | listening | recording | uploading | finished
    this.speechStartCandidate = 0;
    this.silenceStart = 0;
    this.takeStart = 0;

    this.els.startBtn.addEventListener("click", () => this.start());
    this.els.skipBtn.addEventListener("click", () => this.app.toLibrary());
    this.els.redoBtn.addEventListener("click", () => this.redo());
  }

  /** 부팅 시 호출: 기존 레퍼런스가 있으면 넘어가기 버튼 노출 */
  init(hasUserReference) {
    this.els.skipBtn.classList.toggle("hidden", !hasUserReference);
    if (hasUserReference) {
      this.setStatus("등록된 목소리가 있어요. 새로 등록하거나 넘어가세요.", "");
    }
  }

  setStatus(text, dotClass) {
    this.els.status.textContent = text;
    this.els.micDot.className = `micDot ${dotClass || ""}`;
  }

  showPrompt() {
    this.els.step.textContent = `${this.index + 1} / ${this.prompts.length}`;
    this.els.prompt.textContent = `“${this.prompts[this.index]}”`;
  }

  async start() {
    try {
      const data = await this.app.api.voicePrompts();
      this.prompts = data.prompts;

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(this.stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.els.startBtn.classList.add("hidden");
      this.els.skipBtn.classList.add("hidden");
      this.els.redoBtn.classList.remove("hidden");

      this.index = 0;
      await this.app.api.resetVoice().catch(() => {});
      this.beginPrompt();
      requestAnimationFrame(() => this.tick());
    } catch (error) {
      this.setStatus(`마이크를 사용할 수 없어요: ${error.message}`, "");
    }
  }

  beginPrompt() {
    this.showPrompt();
    this.phase = "listening";
    this.speechStartCandidate = 0;
    this.setStatus("말씀해 주세요, 듣고 있어요…", "listening");
  }

  redo() {
    if (this.phase === "recording" && this.recorder) {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    if (["listening", "recording"].includes(this.phase)) this.beginPrompt();
  }

  currentRms() {
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.sqrt(sum / buf.length);
  }

  tick() {
    if (this.phase === "finished") return;

    const rms = this.currentRms();
    this.els.meter.style.width = `${Math.min(100, rms * 900)}%`;
    const now = performance.now();

    if (this.phase === "listening") {
      if (rms >= START_RMS) {
        if (!this.speechStartCandidate) this.speechStartCandidate = now;
        if (now - this.speechStartCandidate >= START_HOLD_MS) this.startTake();
      } else {
        this.speechStartCandidate = 0;
      }
    } else if (this.phase === "recording") {
      if (rms < STOP_RMS) {
        if (!this.silenceStart) this.silenceStart = now;
        if (now - this.silenceStart >= SILENCE_MS) this.stopTake();
      } else {
        this.silenceStart = 0;
      }
      if (now - this.takeStart >= MAX_TAKE_MS) this.stopTake();
    }

    requestAnimationFrame(() => this.tick());
  }

  startTake() {
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.onstop = () => this.onTakeReady();
    this.recorder.start();

    this.phase = "recording";
    this.takeStart = performance.now();
    this.silenceStart = 0;
    this.setStatus("녹음 중… 다 말하면 잠깐 기다려 주세요", "recording");
  }

  stopTake() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
  }

  async onTakeReady() {
    const tookMs = performance.now() - this.takeStart;
    const blob = new Blob(this.chunks, { type: this.recorder.mimeType || "audio/webm" });

    if (tookMs < MIN_TAKE_MS || blob.size < 2000) {
      this.beginPrompt(); // 기침/터치 소리 등은 무시하고 같은 프롬프트 재시도
      return;
    }

    this.phase = "uploading";
    this.setStatus("확인 중…", "");
    try {
      await this.app.api.saveRecording(this.index, blob);
    } catch (error) {
      this.setStatus(`업로드 실패: ${error.message} — 다시 말해 주세요`, "listening");
      this.phase = "listening";
      this.speechStartCandidate = 0;
      return;
    }

    this.setStatus("좋아요! 👍", "");
    await new Promise((r) => setTimeout(r, 700));

    this.index += 1;
    if (this.index < this.prompts.length) {
      this.beginPrompt();
    } else {
      this.finalize();
    }
  }

  async finalize() {
    this.phase = "uploading";
    this.els.redoBtn.classList.add("hidden");
    this.setStatus("목소리를 만드는 중이에요… 잠시만요", "");
    try {
      const data = await this.app.api.finalizeVoice();
      this.phase = "finished";
      this.releaseMic();
      this.setStatus(`🎉 목소리 등록 완료! (${Math.round(data.seconds || 0)}초)`, "");
      setTimeout(() => this.app.toLibrary(), 1200);
    } catch (error) {
      this.setStatus(`레퍼런스 생성 실패: ${error.message}`, "");
      this.phase = "finished";
      this.releaseMic();
      this.els.startBtn.classList.remove("hidden");
      this.els.startBtn.textContent = "🎙️ 다시 시도";
    }
  }

  releaseMic() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
