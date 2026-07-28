/**
 * ReadingSession — 현재 읽고 있는 책/레벨/페이지 상태.
 * 모든 브라우저 클라이언트가 이 스냅샷을 SSE("state")로 공유한다.
 * (DB 연동 시: 아이별 진도 저장/복원의 교체 지점)
 */

class ReadingSession {
  constructor({ stories, sse }) {
    this.stories = stories;
    this.sse = sse;
    this.story = null;
    this.level = 1;
    this.page = 0;
  }

  open(bookId, { level = 1, page = 0 } = {}) {
    const story = this.stories.get(bookId);
    if (!story) throw new Error(`unknown book: ${bookId}`);
    this.story = story;
    this.level = level;
    this.page = this.clampPage(page);
    this.broadcast("open");
    return this.snapshot();
  }

  close() {
    this.story = null;
    this.level = 1;
    this.page = 0;
    this.broadcast("close");
  }

  setState({ level, page }, source) {
    if (!this.story) throw new Error("no book is open");
    if (level !== undefined && [1, 2, 3].includes(Number(level))) {
      this.level = Number(level);
      this.page = this.clampPage(this.page);
    }
    if (page !== undefined) {
      this.page = this.clampPage(Number(page));
    }
    this.broadcast(source);
    return this.snapshot();
  }

  clampPage(page) {
    if (!this.story || !Number.isFinite(page)) return 0;
    const count = this.story.pageCount(this.level);
    return Math.min(Math.max(0, Math.trunc(page)), count - 1);
  }

  snapshot() {
    if (!this.story) {
      return { bookId: null };
    }
    return {
      bookId: this.story.id,
      title: this.story.title,
      level: this.level,
      page: this.page,
      pageCount: this.story.pageCount(this.level),
      sentences: this.story.pageSentences(this.level, this.page)
    };
  }

  broadcast(source) {
    this.sse.broadcast("state", { ...this.snapshot(), source: source || "server" });
  }
}

module.exports = { ReadingSession };
