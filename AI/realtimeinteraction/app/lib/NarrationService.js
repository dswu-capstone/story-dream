/**
 * NarrationService — 책별 나레이션(TTS) 생성과 진행률 관리.
 *
 * 책을 클릭하면 voice_cloning.py(Fish Audio 보이스 클로닝)를 백그라운드로
 * 실행해 public/assets/audio/<bookId>/level{N}/page-XXX.wav 를 채운다.
 * 진행률은 자식 프로세스의 "PROGRESS {json}" stdout 라인을 파싱해
 * SSE("narration" 이벤트)로 흘려보낸다.
 *
 * 리더 입장은 전체 완료를 기다리지 않는다: level1 앞쪽 enterReadyPages장이
 * 준비되면 enterReady=true가 되고, 나머지는 백그라운드에서 계속 생성된다.
 * (DB/웹서버 연동 시: 생성을 서버 큐로 옮기고 이 클래스는 잡 상태 조회로 교체)
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const LEVELS = [1, 2, 3];

class NarrationJob {
  constructor(bookId, total) {
    this.bookId = bookId;
    this.state = "running"; // running | done | error | skipped
    this.done = 0;
    this.total = total;
    this.current = null; // {level, index}
    this.error = null;
    this.startedAt = Date.now();
  }

  toJSON() {
    return {
      bookId: this.bookId,
      state: this.state,
      done: this.done,
      total: this.total,
      current: this.current,
      error: this.error
    };
  }
}

class NarrationService {
  constructor({ audioRoot, pythonBin, script, fishApiKey, enterReadyPages, stories, voice, sse }) {
    this.audioRoot = audioRoot;
    this.pythonBin = pythonBin;
    this.script = script;
    this.fishApiKey = fishApiKey;
    this.enterReadyPages = enterReadyPages;
    this.stories = stories;
    this.voice = voice;
    this.sse = sse;
    this.jobs = new Map(); // bookId -> NarrationJob
  }

  audioDir(bookId) {
    return path.join(this.audioRoot, bookId);
  }

  pagePath(bookId, level, index) {
    return path.join(
      this.audioDir(bookId),
      `level${level}`,
      `page-${String(index).padStart(3, "0")}.wav`
    );
  }

  /** level의 앞쪽부터 연속으로 준비된 페이지 수 (재생은 순서대로 하므로) */
  readyPages(bookId, level, pageCount) {
    let ready = 0;
    while (ready < pageCount && fs.existsSync(this.pagePath(bookId, level, ready))) {
      ready += 1;
    }
    return ready;
  }

  /** 책 하나의 나레이션 상태 요약 (서재/버퍼링 화면에서 사용) */
  status(story) {
    const bookId = story.id;
    const levels = {};
    for (const level of LEVELS) {
      const total = story.pageCount(level);
      const ready = this.readyPages(bookId, level, total);
      levels[level] = { ready, total, complete: ready >= total };
    }
    const job = this.jobs.get(bookId) || null;
    const level1 = levels[1];
    const enterReady =
      level1.ready >= Math.min(this.enterReadyPages, level1.total) ||
      (job && ["done", "skipped"].includes(job.state)) ||
      (!this.fishApiKey && !job);

    return {
      bookId,
      levels,
      job: job ? job.toJSON() : null,
      enterReady: Boolean(enterReady),
      generatorAvailable: Boolean(this.fishApiKey)
    };
  }

  /** 나레이션 생성 시작. 이미 실행 중이거나 완료돼 있으면 그대로 반환. */
  start(story) {
    const bookId = story.id;
    const existing = this.jobs.get(bookId);
    if (existing && existing.state === "running") {
      return this.status(story);
    }

    // 이미 전부 만들어져 있으면 job 없이 바로 입장 가능
    const complete = LEVELS.every(
      (l) => this.readyPages(bookId, l, story.pageCount(l)) >= story.pageCount(l)
    );
    if (complete) {
      return this.status(story);
    }

    if (!this.fishApiKey) {
      const job = new NarrationJob(bookId, story.totalPages());
      job.state = "skipped";
      job.error = "FISH_AUDIO_API_KEY not set";
      this.jobs.set(bookId, job);
      this.broadcast(job);
      return this.status(story);
    }

    const job = new NarrationJob(bookId, story.totalPages());
    this.jobs.set(bookId, job);

    const reference = this.voice.activeReference();
    console.log(
      `[narration] ${bookId}: generating with reference=${reference.source} (${reference.path})`
    );

    const child = spawn(
      this.pythonBin,
      [
        this.script,
        "--dataset", story.jsonlPath,
        "--out-root", this.audioDir(bookId)
      ],
      {
        cwd: path.dirname(this.script),
        env: {
          ...process.env,
          FISH_AUDIO_API_KEY: this.fishApiKey,
          REFERENCE_AUDIO: reference.path,
          PYTHONUNBUFFERED: "1"
        }
      }
    );

    let lineBuffer = "";
    child.stdout.on("data", (chunk) => {
      lineBuffer += chunk;
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop();
      for (const line of lines) {
        this.handleLine(job, line);
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(`[narration] ${chunk}`));
    child.on("error", (error) => {
      job.state = "error";
      job.error = error.message;
      this.broadcast(job);
    });
    child.on("close", (code) => {
      if (job.state === "running") {
        job.state = code === 0 ? "done" : "error";
        if (code !== 0) job.error = `voice_cloning.py exit ${code}`;
      }
      console.log(`[narration] ${bookId}: ${job.state} (${job.done}/${job.total})`);
      this.broadcast(job);
    });

    return this.status(story);
  }

  handleLine(job, line) {
    if (!line.startsWith("PROGRESS ")) {
      if (line.trim()) console.log(`[narration] ${line}`);
      return;
    }
    try {
      const progress = JSON.parse(line.slice("PROGRESS ".length));
      job.done = progress.done;
      job.total = progress.total || job.total;
      job.current = { level: progress.level, index: progress.index, status: progress.status };
      this.broadcast(job);
    } catch {
      // 진행률 한 줄 파싱 실패는 무시
    }
  }

  broadcast(job) {
    this.sse.broadcast("narration", job.toJSON());
  }
}

module.exports = { NarrationService, NarrationJob };
