/**
 * AppConfig — 앱 전체 설정의 단일 소스.
 * env를 한 곳에서 해석해 모든 서비스 클래스에 주입한다.
 * (나중에 웹서버/DB 연동 시, 이 값들을 원격 설정으로 바꾸는 지점도 여기)
 */

const fs = require("fs");
const path = require("path");

class AppConfig {
  constructor(env, appDir) {
    this.appDir = appDir; // realtimeinteraction/app
    this.rootDir = path.dirname(appDir); // realtimeinteraction

    this.port = Number(env.PORT || 4000);
    this.host = env.HOST || "0.0.0.0";

    // data locations
    this.datasetDir = env.DATASET_DIR || path.join(this.rootDir, "dataset");
    this.publicDir = path.join(appDir, "public");
    this.dreamyAssetsDir = env.DREAMY_ASSETS_DIR || path.join(this.rootDir, "dreamy_assets");
    this.audioRoot = path.join(this.publicDir, "assets", "audio");
    this.logsDir = env.LOGS_DIR || path.join(appDir, "logs");
    this.recordingsDir = path.join(appDir, "recordings");
    this.quizLogFile = env.QUIZ_LOG_FILE || path.join(this.logsDir, "quiz-log.jsonl");

    // voice reference
    this.userReferenceWav = path.join(this.datasetDir, "reference_user.wav");
    this.defaultReferenceWav =
      env.REFERENCE_AUDIO || path.join(this.datasetDir, "reference_1min.wav");

    // external services
    this.openaiApiKey = env.OPENAI_API_KEY || "";
    this.fishAudioApiKey = env.FISH_AUDIO_API_KEY || "";

    // python helpers
    this.pythonBin =
      env.PYTHON_BIN ||
      (fs.existsSync("/home/pi/yolo-env/bin/python")
        ? "/home/pi/yolo-env/bin/python"
        : "python3");
    // 집중 감지 소스: "browser"(PC 웹캠, 기본) | "camera"(서버/파이 카메라)
    this.focusSource = (env.FOCUS_SOURCE || "browser").toLowerCase();
    // 서버 카메라(camera_focus.py)는 camera 모드에서만, CAMERA_FOCUS=0 이면 강제 비활성
    this.cameraFocusEnabled = this.focusSource === "camera" && env.CAMERA_FOCUS !== "0";
    this.cameraFocusScript = path.join(appDir, "camera_focus.py");
    this.poseWorkerScript = path.join(appDir, "pose_worker.py");
    this.voiceCloningScript = path.join(appDir, "voice_cloning.py");
    this.buildReferenceScript = path.join(appDir, "build_reference.py");

    // story pagination
    this.sentencesPerPage = Number(env.SENTENCES_PER_PAGE || 4);

    // realtime quiz character
    this.character = {
      childName: env.CHILD_NAME || "민준",
      characterName: env.CHARACTER_NAME || "아기 오리",
      voice: env.REALTIME_VOICE || "marin",
      model: env.REALTIME_MODEL || "gpt-realtime-2",
      threshold: 0.5,
      prefixPaddingMs: 300,
      silenceDurationMs: 700,
      answerTimeoutMs: Number(env.ANSWER_TIMEOUT_MS || 10000),
      maxReminders: Number(env.MAX_REMINDERS || 6),
      quizCooldownMs: Number(env.QUIZ_COOLDOWN_MS || 20000)
    };

    // 이 수만큼 level1 페이지 오디오가 준비되면 리더에 먼저 입장시킨다.
    // (나머지 페이지는 백그라운드에서 계속 생성)
    this.enterReadyPages = Number(env.ENTER_READY_PAGES || 3);
  }
}

module.exports = { AppConfig };
