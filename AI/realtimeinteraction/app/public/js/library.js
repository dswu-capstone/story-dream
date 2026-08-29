/**
 * LibraryScreen — 디지털 서재.
 * 책들을 책장 위 표지 모양으로 그리고, 클릭하면 App.selectBook으로 넘긴다.
 *
 * LoadingOverlay — 나레이션 생성(버퍼링) 진행률 표시.
 */

export class LibraryScreen {
  constructor(app) {
    this.app = app;
    this.grid = document.querySelector("#bookGrid");
    this.books = [];
  }

  async open() {
    const data = await this.app.api.books();
    this.books = data.books;
    this.render();
  }

  render() {
    this.grid.innerHTML = "";
    for (const book of this.books) {
      this.grid.appendChild(this.renderBook(book));
    }
    if (this.books.length === 0) {
      const empty = document.createElement("p");
      empty.className = "libEmpty";
      empty.textContent = "dataset 폴더에 동화 jsonl을 넣으면 책이 나타나요";
      this.grid.appendChild(empty);
    }
  }

  renderBook(book) {
    const el = document.createElement("button");
    el.className = "book";

    const cover = document.createElement("div");
    cover.className = "bookCover";
    if (book.cover) {
      cover.style.backgroundImage = `url("${book.cover}")`;
    } else {
      cover.classList.add("noImage");
    }

    const title = document.createElement("span");
    title.className = "bookTitle";
    title.textContent = book.title;
    cover.appendChild(title);

    const badge = document.createElement("span");
    badge.className = "bookBadge";
    const level1 = book.narration?.levels?.[1];
    if (level1 && level1.complete) {
      badge.textContent = "🔊 준비됨";
      badge.classList.add("ready");
    } else if (level1 && level1.ready > 0) {
      badge.textContent = `🎵 ${level1.ready}/${level1.total}`;
    } else {
      badge.textContent = "🎵 목소리 만들기";
    }
    cover.appendChild(badge);

    el.appendChild(cover);
    el.addEventListener("click", () => this.app.selectBook(book));
    return el;
  }
}

export class LoadingOverlay {
  constructor() {
    this.root = document.querySelector("#loading");
    this.title = document.querySelector("#loadingTitle");
    this.bar = document.querySelector("#progressBar");
    this.detail = document.querySelector("#loadingDetail");
  }

  show(bookTitle) {
    this.title.textContent = `『${bookTitle}』`;
    this.bar.style.width = "0%";
    this.detail.textContent = "내 목소리로 이야기를 준비하고 있어요…";
    this.root.classList.remove("hidden");
  }

  progress(done, total, currentText) {
    if (total > 0) {
      this.bar.style.width = `${Math.round((done / total) * 100)}%`;
    }
    if (currentText) this.detail.textContent = currentText;
  }

  note(text) {
    this.detail.textContent = text;
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
