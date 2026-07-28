/**
 * FocusMonitor — camera_focus.py(YOLO pose, ONNX) 자식 프로세스 관리.
 * 카메라가 보낸 집중 이벤트를 정규화해 보관하고 SSE("focus")로 중계한다.
 */

const { spawn } = require("child_process");

class FocusMonitor {
  constructor({ enabled, pythonBin, script, serverPort, sse }) {
    this.enabled = enabled;
    this.pythonBin = pythonBin;
    this.script = script;
    this.serverPort = serverPort;
    this.sse = sse;
    this.process = null;
    this.restarts = 0;
    this.latest = null;
    this.latestFrame = null; // 주석 입힌 최신 카메라 프레임 (base64 JPEG)
  }

  start() {
    if (!this.enabled) {
      console.log("[camera] CAMERA_FOCUS=0, not starting camera_focus.py");
      return;
    }
    console.log(`[camera] starting: ${this.pythonBin} ${this.script}`);
    this.process = spawn(this.pythonBin, [this.script], {
      env: {
        ...process.env,
        APP_SERVER_URL: `http://127.0.0.1:${this.serverPort}`,
        PYTHONUNBUFFERED: "1"
      },
      stdio: ["ignore", "inherit", "inherit"]
    });
    this.process.on("exit", (code) => {
      this.process = null;
      if (code !== 0 && this.restarts < 5) {
        this.restarts += 1;
        const delay = 3000 * this.restarts;
        console.log(`[camera] exited with ${code}, restart #${this.restarts} in ${delay}ms`);
        setTimeout(() => this.start(), delay);
      } else {
        console.log(`[camera] exited with ${code}, not restarting`);
      }
    });
  }

  stop() {
    if (this.process) this.process.kill();
  }

  /** POST /api/focus 로 들어온 신호를 정규화해 브로드캐스트 */
  handleSignal(incoming) {
    const signal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType: incoming.eventType || "focus_state",
      state: incoming.state || "unknown",
      source: incoming.source || "camera-focus",
      detail: incoming.detail || "",
      timestamp: incoming.timestamp || new Date().toISOString()
    };
    this.latest = signal;
    this.sse.broadcast("focus", signal);
    return signal;
  }

  /** POST /api/camera-frame — /monitor 페이지로 중계 */
  handleFrame(incoming) {
    if (!incoming.image) throw new Error("Missing image");
    const frame = {
      image: incoming.image,
      state: incoming.state || "unknown",
      timestamp: incoming.timestamp || new Date().toISOString()
    };
    this.latestFrame = frame;
    this.sse.broadcast("camera", frame);
    return { state: frame.state, timestamp: frame.timestamp };
  }

  /** YOLO가 살아있는지 한눈에 (GET /api/camera/status) */
  status() {
    return {
      enabled: this.enabled,
      processRunning: Boolean(this.process),
      restarts: this.restarts,
      lastSignal: this.latest
        ? { eventType: this.latest.eventType, state: this.latest.state, timestamp: this.latest.timestamp }
        : null,
      lastFrameAt: this.latestFrame ? this.latestFrame.timestamp : null
    };
  }
}

module.exports = { FocusMonitor };
