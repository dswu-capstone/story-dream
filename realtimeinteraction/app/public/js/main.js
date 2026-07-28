/**
 * App — 화면 흐름 오케스트레이터.
 *
 *   등록(EnrollScreen) → 서재(LibraryScreen)
 *     → 책 클릭: 나레이션 생성 시작 + LoadingOverlay(버퍼링)
 *     → level1 앞쪽 페이지가 준비되는 즉시 리더(ReaderScreen) 입장, TTS 시작
 *       (나머지 페이지는 백그라운드에서 계속 생성)
 *
 * SseClient — 서버 SSE(/api/events) 구독: state / focus / narration / quizlog.
 */

import { ApiClient } from "./api.js";
import { EnrollScreen } from "./enroll.js";
import { LibraryScreen, LoadingOverlay } from "./library.js";
import { ReaderScreen } from "./reader.js";

class SseClient {
  constructor() {
    this.handlers = new Map();
    this.source = new EventSource("/api/events");
  }

  on(event, fn) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
      this.source.addEventListener(event, (e) => {
        const data = JSON.parse(e.data);
        for (const handler of this.handlers.get(event)) handler(data);
      });
    }
    this.handlers.get(event).push(fn);
  }
}

class App {
  constructor() {
    this.api = new ApiClient();
    this.sse = new SseClient();
    this.session = null;
    this.current = "enroll";

    this.screens = {
      enroll: document.querySelector("#screen-enroll"),
      library: document.querySelector("#screen-library"),
      reader: document.querySelector("#screen-reader")
    };

    this.enroll = new EnrollScreen(this);
    this.library = new LibraryScreen(this);
    this.reader = new ReaderScreen(this);
    this.loading = new LoadingOverlay();

    this.selecting = false; // 책 더블탭 방지

    this.sse.on("state", (snapshot) => {
      if (this.current === "reader" && snapshot.bookId === this.reader.view.bookId) {
        this.reader.render(snapshot);
      }
    });
    this.sse.on("focus", (signal) => this.reader.onFocusSignal(signal));
    this.sse.on("narration", (job) => this.onNarrationProgress(job));
  }

  async boot() {
    try {
      this.session = await this.api.session();
    } catch (error) {
      document.body.innerHTML = `<p style="color:#fff;padding:40px">서버 연결 실패: ${error.message}</p>`;
      return;
    }

    // 목소리가 이미 등록돼 있으면 등록 화면을 건너뛰고 바로 서재로.
    // (다시 등록하려면 ?screen=enroll 로 접속)
    this.enroll.init(this.session.voice.userReference);
    const screen = new URLSearchParams(location.search).get("screen");
    if (this.session.voice.userReference && screen !== "enroll") {
      this.show("library");
      this.toLibrary();
    } else {
      this.show("enroll");
    }

    // 개발/복귀용: ?screen=library|reader 로 화면 바로 열기
    if (screen === "library") {
      this.toLibrary();
    } else if (screen === "reader") {
      const { books } = await this.api.books();
      if (books[0]) {
        const snapshot = await this.api.openBook(books[0].id);
        this.show("reader");
        this.reader.open(snapshot);
      }
    }
  }

  show(name) {
    this.current = name;
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle("hidden", key !== name);
    }
  }

  async toLibrary() {
    this.enroll.releaseMic?.();
    this.show("library");
    try {
      await this.library.open();
    } catch (error) {
      console.log("library load failed:", error.message);
    }
  }

  async backToLibrary() {
    this.reader.close();
    this.api.closeSession().catch(() => {});
    await this.toLibrary();
  }

  // ---- 책 선택 → 나레이션 준비(버퍼링) → 리더 입장 ----

  async selectBook(book) {
    if (this.selecting) return;
    this.selecting = true;
    this.pendingBookId = book.id;

    try {
      // 이미 만들어진 페이지는 건너뛰므로(voice_cloning.py) 재생성 걱정 없이 호출.
      // level1이 이미 준비된 책이면 버퍼링 화면 없이 바로 입장한다.
      let status = await this.api.startNarration(book.id);
      if (!status.enterReady) this.loading.show(book.title);
      this.renderNarrationStatus(status);

      // enterReady가 될 때까지 폴링 (SSE 진행률은 그 사이 진행바를 채움)
      while (!status.enterReady) {
        if (status.job && status.job.state === "error") {
          this.loading.note("음성 생성에 실패했어요. 나레이션 없이 시작할게요.");
          await this.delay(1500);
          break;
        }
        if (status.job && status.job.state === "skipped") {
          this.loading.note("음성 생성 설정이 없어 나레이션 없이 시작할게요.");
          await this.delay(1500);
          break;
        }
        await this.delay(1500);
        status = await this.api.narrationStatus(book.id);
        this.renderNarrationStatus(status);
      }

      const snapshot = await this.api.openBook(book.id);
      this.loading.hide();
      this.show("reader");
      this.reader.open(snapshot);
    } catch (error) {
      this.loading.note(`문제가 생겼어요: ${error.message}`);
      await this.delay(2000);
      this.loading.hide();
    } finally {
      this.selecting = false;
      this.pendingBookId = null;
    }
  }

  renderNarrationStatus(status) {
    const level1 = status.levels?.[1];
    if (status.job && status.job.state === "running") {
      this.loading.progress(
        status.job.done,
        status.job.total,
        level1
          ? `내 목소리로 읽는 중… ${level1.ready}/${level1.total}장 준비됨 (전체 ${status.job.done}/${status.job.total})`
          : `준비 중… ${status.job.done}/${status.job.total}`
      );
    } else if (level1 && level1.complete) {
      this.loading.progress(1, 1, "준비 완료!");
    }
  }

  onNarrationProgress(job) {
    // 버퍼링 화면이 열려 있는 책의 진행률만 반영
    if (this.pendingBookId && job.bookId === this.pendingBookId && job.state === "running") {
      this.loading.progress(job.done, job.total);
    }
  }

  delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

const app = new App();
app.boot();
