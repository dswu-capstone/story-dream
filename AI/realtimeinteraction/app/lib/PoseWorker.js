/**
 * PoseWorker — pose_worker.py(YOLO pose, ONNX) 상주 프로세스 관리.
 *
 * 브라우저 웹캠 모드에서 쓰인다. 브라우저가 보낸 프레임(base64 JPEG)을 stdin 으로
 * 넘기고 stdout 한 줄(JSON)로 분류 결과를 돌려받는다. 모델은 프로세스당 1회만
 * 로드하므로 프레임마다 파이썬을 새로 띄우지 않는다.
 */

const { spawn } = require("child_process");

class PoseWorker {
  constructor({ pythonBin, script }) {
    this.pythonBin = pythonBin;
    this.script = script;
    this.process = null;
    this.ready = false;
    this.seq = 0;
    this.pending = new Map(); // id -> {resolve, timer}
    this.buffer = "";
    this.restarts = 0;
  }

  start() {
    console.log(`[pose] starting: ${this.pythonBin} ${this.script}`);
    this.process = spawn(this.pythonBin, [this.script], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "inherit"]
    });
    this.ready = true;

    this.process.stdout.on("data", (chunk) => this.onData(chunk));
    this.process.on("exit", (code) => {
      this.ready = false;
      this.process = null;
      for (const { resolve, timer } of this.pending.values()) {
        clearTimeout(timer);
        resolve({ state: "absent" });
      }
      this.pending.clear();
      if (this.restarts < 5) {
        this.restarts += 1;
        const delay = 2000 * this.restarts;
        console.log(`[pose] exited with ${code}, restart #${this.restarts} in ${delay}ms`);
        setTimeout(() => this.start(), delay);
      } else {
        console.log(`[pose] exited with ${code}, not restarting`);
      }
    });
  }

  stop() {
    if (this.process) this.process.kill();
  }

  onData(chunk) {
    this.buffer += chunk.toString("utf8");
    let idx;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const entry = this.pending.get(msg.id);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(msg.id);
        entry.resolve({ state: msg.state || "absent" });
      }
    }
  }

  /** 프레임(base64 JPEG)을 분류해 {state} 를 돌려준다. */
  classify(imageBase64) {
    if (!this.process || !this.ready) return Promise.resolve({ state: "absent" });
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ state: "absent" }); // 워커가 느리면 프레임을 버린다
      }, 2000);
      this.pending.set(id, { resolve, timer });
      try {
        this.process.stdin.write(JSON.stringify({ id, image: imageBase64 }) + "\n");
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ state: "absent" });
      }
    });
  }
}

module.exports = { PoseWorker };
