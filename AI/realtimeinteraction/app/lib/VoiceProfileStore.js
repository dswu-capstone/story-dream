/**
 * VoiceProfileStore — 사용자 목소리 레퍼런스 관리.
 *
 * 등록 화면에서 올라온 프롬프트별 녹음을 보관하고, build_reference.py로
 * 하나의 레퍼런스 WAV(dataset/reference_user.wav)를 만든다.
 * (DB 연동 시: 녹음/레퍼런스를 오브젝트 스토리지에 두고 메타데이터만 DB로)
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// 사용자가 따라 읽을 문장들. 앞은 워밍업, 뒤는 동화 낭독 톤 확보용.
const DEFAULT_PROMPTS = [
  "안녕하세요",
  "만나서 반가워요. 지금부터 제 목소리로 동화를 읽어 볼게요.",
  "옛날 옛날, 어느 연못가에서 엄마 오리가 알을 품고 있었어요.",
  "앗! 마지막 알에서 커다랗고 못생긴 아기 오리가 나왔어요.",
  "아기 오리는 너무 힘들었어요.",
  "모두들 아기 오리를 미워하고 놀렸어요.",
  "그래서 아기 오리는 혼자 먼 곳으로 떠났답니다.",
  "추운 겨울이 지나고, 따뜻한 봄이 찾아왔어요.",
  "물에 비친 모습을 보니, 아기 오리는 아름다운 백조가 되어 있었어요!",
  "우리 다음 이야기에서 또 만나요. 안녕!"
];

class VoiceProfileStore {
  constructor({ recordingsDir, userReferenceWav, defaultReferenceWav, pythonBin, buildScript }) {
    this.recordingsDir = recordingsDir;
    this.userReferenceWav = userReferenceWav;
    this.defaultReferenceWav = defaultReferenceWav;
    this.pythonBin = pythonBin;
    this.buildScript = buildScript;
    this.prompts = DEFAULT_PROMPTS;
  }

  hasUserReference() {
    return fs.existsSync(this.userReferenceWav);
  }

  /** 나레이션 생성에 실제로 쓸 레퍼런스: 사용자 등록본 우선, 없으면 기본본 */
  activeReference() {
    if (this.hasUserReference()) {
      return { path: this.userReferenceWav, source: "user" };
    }
    return { path: this.defaultReferenceWav, source: "default" };
  }

  status() {
    return {
      userReference: this.hasUserReference(),
      activeSource: this.activeReference().source,
      promptCount: this.prompts.length
    };
  }

  saveRecording(index, buffer, contentType) {
    if (!Number.isInteger(index) || index < 0 || index >= this.prompts.length) {
      throw new Error("invalid prompt index");
    }
    if (buffer.length < 1000) {
      throw new Error("recording too short");
    }
    fs.mkdirSync(this.recordingsDir, { recursive: true });

    const ext = VoiceProfileStore.extensionFor(contentType);
    const stem = `prompt-${String(index).padStart(2, "0")}`;
    // 같은 프롬프트 재녹음 시 이전 테이크 교체
    for (const old of fs.readdirSync(this.recordingsDir)) {
      if (old.startsWith(`${stem}.`)) fs.unlinkSync(path.join(this.recordingsDir, old));
    }
    const file = path.join(this.recordingsDir, `${stem}.${ext}`);
    fs.writeFileSync(file, buffer);
    return { file: path.basename(file), bytes: buffer.length };
  }

  clearRecordings() {
    if (!fs.existsSync(this.recordingsDir)) return;
    for (const file of fs.readdirSync(this.recordingsDir)) {
      fs.unlinkSync(path.join(this.recordingsDir, file));
    }
  }

  /** 녹음들을 하나의 레퍼런스 WAV로 합친다 (build_reference.py). */
  finalize() {
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.pythonBin,
        [
          this.buildScript,
          "--recordings", this.recordingsDir,
          "--out", this.userReferenceWav,
          "--transcript", this.prompts.join(" ")
        ],
        { cwd: path.dirname(this.buildScript) }
      );

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", reject);
      child.on("close", (code) => {
        process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (code !== 0) {
          reject(new Error(stderr.trim() || `build_reference.py exit ${code}`));
          return;
        }
        try {
          const lines = stdout.trim().split("\n");
          resolve(JSON.parse(lines[lines.length - 1]));
        } catch {
          resolve({ ok: true, out: this.userReferenceWav });
        }
      });
    });
  }

  static extensionFor(contentType) {
    if (!contentType) return "webm";
    if (contentType.includes("ogg")) return "ogg";
    if (contentType.includes("wav")) return "wav";
    if (contentType.includes("mp4")) return "mp4";
    return "webm";
  }
}

module.exports = { VoiceProfileStore };
