import { realtimeInteractionApiBase } from "./realtimeInteraction";

export const FOCUS_INTERACTION_THRESHOLD_SECONDS = 10;

export type FocusSignal = {
  id?: string;
  eventType: string;
  state: string;
  source?: string;
  detail?: string;
  timestamp?: string;
};

type DetectPoseResponse = {
  ok: boolean;
  state?: string;
  error?: string;
};

const SMOOTH_WINDOW = 8;
const HEARTBEAT_INTERVAL_SECONDS = 5;
// 라즈베리파이 CPU 로 YOLO 추론을 돌리므로 너무 자주 보내면 큐가 밀리고
// 보드 전체가 느려진다. 1초에 한 번이면 10초 임계 판정에 충분하다.
const DETECT_INTERVAL_MS = 1000;
const CAPTURE_WIDTH = 256;

/**
 * 카메라는 한 번에 한 곳만 잡을 수 있다(파이 + USB 웹캠).
 * React StrictMode 는 개발 모드에서 effect 를 두 번 실행하므로 모니터 인스턴스가
 * 두 개 생겨 서로 카메라를 뺏다가 getUserMedia 가 멈춰버린다. 또 실시간 상호작용
 * 화면은 마이크를 잡는데, 카메라가 안 놓인 상태면 둘 다 죽는다.
 * 그래서 프로세스 전체에서 한 번에 하나만 카메라를 쓰도록 잠근다.
 */
let cameraOwner: BrowserFocusMonitor | null = null;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${realtimeInteractionApiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { ok?: boolean; error?: string })
    | null;

  if (!response.ok || !data || data.ok === false) {
    throw new Error(data?.error || `집중도 API 요청 실패: ${path}`);
  }

  return data;
}

export function subscribeFocusSignals(
  onSignal: (signal: FocusSignal) => void,
) {
  const source = new EventSource(`${realtimeInteractionApiBase}/events`);
  const handleFocus = (event: Event) => {
    try {
      const signal = JSON.parse((event as MessageEvent<string>).data) as FocusSignal;
      onSignal(signal);
    } catch (error) {
      console.error("집중도 로그를 읽지 못했습니다:", error);
    }
  };

  source.addEventListener("focus", handleFocus);

  return () => {
    source.removeEventListener("focus", handleFocus);
    source.close();
  };
}

export class BrowserFocusMonitor {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private timer: number | null = null;
  private running = false;
  private stopped = false;
  private busy = false;
  private history: string[] = [];
  private distractSince: number | null = null;
  private distractEventSent = false;
  private absentSince: number | null = null;
  private absentEventSent = false;
  private recoveryPending = false;
  private lastHeartbeat = 0;
  private paused = false;
  private pausedAt = 0;

  /** 카메라를 잡고 video/canvas 를 준비한다. 성공하면 true. */
  private async acquireCamera(): Promise<boolean> {
    let stream: MediaStream;
    try {
      // facingMode 는 USB 웹캠에 의미가 없고, 일부 환경에서 제약을 못 맞춰 멈춘다.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (error) {
      console.warn("집중도 감지를 위한 카메라를 사용할 수 없습니다:", error);
      return false;
    }

    if (this.stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    await video.play().catch(() => undefined);

    this.video = video;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
    return true;
  }

  /** 카메라를 놓고 판정 요청을 멈춘다(스트림/타이머만 해제, 상태는 보존). */
  private releaseCamera() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.context = null;
  }

  async start() {
    if (this.running || !navigator.mediaDevices?.getUserMedia) return;
    // 다른 인스턴스가 이미 카메라를 쓰고 있으면(StrictMode 이중 마운트 등) 양보한다.
    if (cameraOwner && cameraOwner !== this) return;
    cameraOwner = this;
    this.stopped = false;

    if (!(await this.acquireCamera())) {
      if (cameraOwner === this) cameraOwner = null;
      return;
    }

    this.running = true;
    this.paused = false;
    this.lastHeartbeat = performance.now() / 1000;
    this.timer = window.setInterval(() => {
      void this.tick();
    }, DETECT_INTERVAL_MS);
  }

  /**
   * 나레이션 재생처럼 다른 장치가 전력을 쓸 때 카메라를 잠시 놓는다.
   * 파이 USB 는 웹캠 + 터치스크린을 동시에 감당하지 못해 과전류가 나고,
   * 그러면 패널이 리셋되면서 HDMI 화면·소리가 같이 끊긴다.
   * 카메라 스트림과 YOLO 판정 요청을 함께 멈추고, 멈춘 동안은 딴짓 시간으로 세지 않는다.
   */
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now() / 1000;
    this.releaseCamera();
  }

  /** pause() 로 놓았던 카메라와 판정을 다시 시작한다. */
  async resume() {
    if (!this.running || !this.paused) return;

    // 멈춰 있던 시간만큼 기준점을 밀어, 그 사이를 딴짓/부재로 세지 않는다.
    const elapsed = performance.now() / 1000 - this.pausedAt;
    if (this.distractSince !== null) this.distractSince += elapsed;
    if (this.absentSince !== null) this.absentSince += elapsed;
    this.lastHeartbeat += elapsed;
    this.paused = false;

    if (!(await this.acquireCamera())) return;
    if (this.stopped || this.paused) return;

    this.timer = window.setInterval(() => {
      void this.tick();
    }, DETECT_INTERVAL_MS);
  }

  stop() {
    this.stopped = true;
    this.running = false;
    this.paused = false;
    this.releaseCamera();
    if (cameraOwner === this) cameraOwner = null;
  }

  private async tick() {
    if (!this.running || this.paused || this.busy) return;
    const image = this.captureFrame();
    if (!image) return;

    this.busy = true;
    try {
      const result = await postJson<DetectPoseResponse>("/detect-pose", { image });
      this.handleState(result.state || "absent");
    } catch {
      // 일시적인 감지 실패는 다음 프레임에서 다시 시도한다.
    } finally {
      this.busy = false;
    }
  }

  private captureFrame() {
    if (!this.video || !this.canvas || !this.context) return null;
    const width = this.video.videoWidth || 640;
    const height = this.video.videoHeight || 480;
    if (!width || !height) return null;

    const captureHeight = Math.round((height / width) * CAPTURE_WIDTH);
    this.canvas.width = CAPTURE_WIDTH;
    this.canvas.height = captureHeight;
    this.context.drawImage(this.video, 0, 0, CAPTURE_WIDTH, captureHeight);
    return this.canvas.toDataURL("image/jpeg", 0.6).split(",")[1] || null;
  }

  private handleState(rawState: string) {
    this.history.push(rawState);
    if (this.history.length > SMOOTH_WINDOW) this.history.shift();
    const state = this.history.length >= 3
      ? getMostCommonValue(this.history)
      : rawState;
    const now = performance.now() / 1000;
    const distracted = state === "side" || state === "back";
    const absent = state === "absent";

    let distractDuration = 0;
    if (distracted) {
      this.distractSince ??= now;
      distractDuration = now - this.distractSince;
    } else {
      this.distractSince = null;
      this.distractEventSent = false;
    }

    let absentDuration = 0;
    if (absent) {
      this.absentSince ??= now;
      absentDuration = now - this.absentSince;
    } else {
      this.absentSince = null;
      this.absentEventSent = false;
    }

    if (
      distractDuration >= FOCUS_INTERACTION_THRESHOLD_SECONDS &&
      !this.distractEventSent
    ) {
      this.emit(
        "focus_lost",
        state,
        `distracted_for=${distractDuration.toFixed(1)}s`,
      );
      this.distractEventSent = true;
      this.recoveryPending = true;
    }

    if (
      absentDuration >= FOCUS_INTERACTION_THRESHOLD_SECONDS &&
      !this.absentEventSent
    ) {
      this.emit("absent", state, `absent_for=${absentDuration.toFixed(1)}s`);
      this.absentEventSent = true;
      this.recoveryPending = true;
    }

    if (state === "front" && this.recoveryPending) {
      this.emit("focus_recovered", state);
      this.recoveryPending = false;
    }

    if (now - this.lastHeartbeat >= HEARTBEAT_INTERVAL_SECONDS) {
      this.emit("focus_state", state, `raw=${rawState}`);
      this.lastHeartbeat = now;
    }
  }

  private emit(eventType: string, state: string, detail = "") {
    void postJson("/focus", {
      eventType,
      state,
      detail,
      source: "story-reading-browser",
      timestamp: new Date().toISOString(),
    }).catch(() => undefined);
  }
}

function getMostCommonValue(values: string[]) {
  const counts = new Map<string, number>();
  let mostCommon = values[0] || "absent";
  let highestCount = 0;

  for (const value of values) {
    const nextCount = (counts.get(value) || 0) + 1;
    counts.set(value, nextCount);
    if (nextCount > highestCount) {
      highestCount = nextCount;
      mostCommon = value;
    }
  }

  return mostCommon;
}
