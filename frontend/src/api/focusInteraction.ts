import { realtimeInteractionApiBase } from "./realtimeInteraction";

export const FOCUS_INTERACTION_THRESHOLD_SECONDS = 15;

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
const DETECT_INTERVAL_MS = 350;
const CAPTURE_WIDTH = 256;

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

  async start() {
    if (this.running || !navigator.mediaDevices?.getUserMedia) return;
    this.stopped = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
    } catch (error) {
      console.warn("집중도 감지를 위한 카메라를 사용할 수 없습니다:", error);
      return;
    }

    if (this.stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return;
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
    this.running = true;
    this.lastHeartbeat = performance.now() / 1000;
    this.timer = window.setInterval(() => {
      void this.tick();
    }, DETECT_INTERVAL_MS);
  }

  stop() {
    this.stopped = true;
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.video) this.video.srcObject = null;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.context = null;
  }

  private async tick() {
    if (!this.running || this.busy) return;
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
