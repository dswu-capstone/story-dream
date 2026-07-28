/**
 * BrowserFocus — 사용자 PC 웹캠으로 집중 감지 (camera_focus.py 의 브라우저판).
 *
 * 웹캠 프레임을 주기적으로 서버(/api/detect-pose)에 보내 YOLO 로 front/side/back/absent
 * 로 분류받고, 여기서 camera_focus.py 와 같은 시간 상태머신(스무딩 + 10초 임계)을 돌려
 * focus_lost / absent / focus_recovered / focus_state 이벤트를 서버(/api/focus)로 POST 한다.
 * 그 뒤 흐름(SSE → reader.onFocusSignal → dreamy 캐릭터)은 서버 카메라 모드와 동일하다.
 *
 * 서버 카메라(camera_focus.py) 코드는 그대로 두고, 프레임 소스만 브라우저로 바꾼 것.
 */

const SMOOTH_WINDOW = 8;
const FOCUS_LOST_THRESHOLD = 10; // 초
const ABSENT_THRESHOLD = 10; // 초
const HEARTBEAT_INTERVAL = 5; // 초
const DETECT_INTERVAL_MS = 350; // ≈3fps
const CAPTURE_WIDTH = 256;

export class BrowserFocus {
  constructor(api) {
    this.api = api;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.running = false;
    this.busy = false;
    this.paused = false;

    this.history = [];
    this.distractSince = null;
    this.focusEventSent = false;
    this.absentSince = null;
    this.absentEventSent = false;
    this.recoveryPending = false;
    this.lastHeartbeat = 0;

    this.timer = null;
  }

  async start() {
    if (this.running) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
    } catch (error) {
      console.log("[browser-focus] webcam unavailable:", error.message);
      return;
    }

    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.running = true;
    this.lastHeartbeat = performance.now() / 1000;
    console.log("[browser-focus] running (PC 웹캠)");
    this.timer = setInterval(() => this.tick(), DETECT_INTERVAL_MS);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  captureBase64() {
    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;
    if (!vw || !vh) return null;
    const w = CAPTURE_WIDTH;
    const h = Math.round((vh / vw) * w);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    const dataUrl = this.canvas.toDataURL("image/jpeg", 0.6);
    return dataUrl.split(",")[1]; // base64 본문만
  }

  /** 퀴즈 진행 중엔 감지를 멈춰 산만 시간이 누적되지 않게 한다. */
  pause() {
    this.paused = true;
  }

  /** 상태머신을 초기화 — 재개 시 산만 카운트를 0부터 다시 센다. */
  reset() {
    this.history = [];
    this.distractSince = null;
    this.focusEventSent = false;
    this.absentSince = null;
    this.absentEventSent = false;
    this.recoveryPending = false;
    this.lastHeartbeat = performance.now() / 1000;
  }

  resume() {
    this.reset();
    this.paused = false;
  }

  async tick() {
    if (!this.running || this.paused || this.busy) return;
    const image = this.captureBase64();
    if (!image) return;
    this.busy = true;
    try {
      const { state } = await this.api.detectPose(image);
      this.onState(state || "absent");
    } catch {
      // 네트워크/워커 오류는 무시하고 다음 프레임
    } finally {
      this.busy = false;
    }
  }

  /** camera_focus.py 의 시간 상태머신을 그대로 옮긴 부분 */
  onState(rawState) {
    this.history.push(rawState);
    if (this.history.length > SMOOTH_WINDOW) this.history.shift();
    const state = this.history.length >= 3 ? mostCommon(this.history) : rawState;

    const now = performance.now() / 1000;
    const isDistracted = state === "side" || state === "back";
    const isAbsent = state === "absent";

    let distractDuration = 0;
    if (isDistracted) {
      if (this.distractSince === null) this.distractSince = now;
      distractDuration = now - this.distractSince;
    } else {
      this.distractSince = null;
      this.focusEventSent = false;
    }

    let absentDuration = 0;
    if (isAbsent) {
      if (this.absentSince === null) this.absentSince = now;
      absentDuration = now - this.absentSince;
    } else {
      this.absentSince = null;
      this.absentEventSent = false;
    }

    if (distractDuration >= FOCUS_LOST_THRESHOLD && !this.focusEventSent) {
      this.emit("focus_lost", state, `distracted_for=${distractDuration.toFixed(1)}s`);
      this.focusEventSent = true;
      this.recoveryPending = true;
    }

    if (absentDuration >= ABSENT_THRESHOLD && !this.absentEventSent) {
      this.emit("absent", state, `absent_for=${absentDuration.toFixed(1)}s`);
      this.absentEventSent = true;
      this.recoveryPending = true;
    }

    if (state === "front" && this.recoveryPending) {
      this.emit("focus_recovered", state);
      this.recoveryPending = false;
    }

    if (now - this.lastHeartbeat >= HEARTBEAT_INTERVAL) {
      this.emit("focus_state", state, `raw=${rawState}`);
      this.lastHeartbeat = now;
    }
  }

  emit(eventType, state, detail = "") {
    this.api.focusSignal({
      eventType,
      state,
      detail,
      source: "browser-webcam",
      timestamp: new Date().toISOString()
    });
  }
}

function mostCommon(arr) {
  const counts = new Map();
  let best = arr[0];
  let bestN = 0;
  for (const v of arr) {
    const n = (counts.get(v) || 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}
