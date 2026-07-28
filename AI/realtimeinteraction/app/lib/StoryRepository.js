/**
 * StoryRepository / Story — 동화 카탈로그.
 *
 * 지금은 dataset/*.jsonl 파일을 스캔해 책 목록을 만들지만, 이 클래스가
 * 웹서버 DB 연동 시 교체 지점이다: 같은 인터페이스(list/get, Story의
 * pages/pageCount)를 유지한 채 내부 구현만 DB 조회로 바꾸면 된다.
 *
 * jsonl 한 줄 = { title, unit_id, level(1|2|3), output, ... } (gongu 포맷)
 */

const fs = require("fs");
const path = require("path");

const LEVELS = [1, 2, 3];

class Story {
  constructor({ id, title, jsonlPath, coverPath }, sentencesPerPage) {
    this.id = id;
    this.title = title;
    this.jsonlPath = jsonlPath;
    this.coverPath = coverPath; // 파일시스템 경로 (없으면 null)
    this.sentencesPerPage = sentencesPerPage;
    this._sentencesByLevel = null; // lazy load
  }

  get sentencesByLevel() {
    if (!this._sentencesByLevel) {
      this._sentencesByLevel = Story.parseJsonl(this.jsonlPath);
    }
    return this._sentencesByLevel;
  }

  static parseJsonl(file) {
    const byLevel = { 1: [], 2: [], 3: [] };
    const raw = fs.readFileSync(file, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const level = Number(row.level);
      if (!byLevel[level]) continue;
      const text = String(row.output || "").replace(/\\n/g, "\n").trim();
      if (!text) continue;
      byLevel[level].push({ unitId: Number(row.unit_id), text });
    }
    for (const level of LEVELS) {
      byLevel[level].sort((a, b) => a.unitId - b.unitId);
    }
    return byLevel;
  }

  pages(level) {
    const items = this.sentencesByLevel[level] || [];
    const pages = [];
    for (let i = 0; i < items.length; i += this.sentencesPerPage) {
      pages.push({
        index: pages.length,
        sentences: items.slice(i, i + this.sentencesPerPage).map((it) => it.text)
      });
    }
    return pages;
  }

  pageCount(level) {
    const items = this.sentencesByLevel[level] || [];
    return Math.max(1, Math.ceil(items.length / this.sentencesPerPage));
  }

  pageSentences(level, page) {
    const pages = this.pages(level);
    return pages[page] ? pages[page].sentences : [];
  }

  totalPages() {
    return LEVELS.reduce((sum, level) => sum + this.pageCount(level), 0);
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      hasCover: Boolean(this.coverPath),
      pageCounts: Object.fromEntries(LEVELS.map((l) => [l, this.pageCount(l)]))
    };
  }
}

class StoryRepository {
  constructor({ datasetDir, sentencesPerPage }) {
    this.datasetDir = datasetDir;
    this.sentencesPerPage = sentencesPerPage;
    this.stories = new Map();
    this.refresh();
  }

  /** dataset 폴더를 다시 스캔한다 (책 추가 시 서버 재시작 없이 호출 가능). */
  refresh() {
    this.stories.clear();
    if (!fs.existsSync(this.datasetDir)) return;

    for (const file of fs.readdirSync(this.datasetDir)) {
      if (!file.endsWith(".jsonl")) continue;
      const jsonlPath = path.join(this.datasetDir, file);
      const title = StoryRepository.readTitle(jsonlPath) || path.basename(file, ".jsonl");
      const id = StoryRepository.makeId(file);
      const coverPath = this.findCover(title);
      this.stories.set(id, new Story({ id, title, jsonlPath, coverPath }, this.sentencesPerPage));
    }
  }

  /** URL/디렉토리에 안전한 책 id: gongu_0059_... -> gongu-0059 */
  static makeId(filename) {
    const gongu = filename.match(/^gongu[_-](\d+)/i);
    if (gongu) return `gongu-${gongu[1]}`;
    const ascii = filename
      .replace(/\.jsonl$/, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    if (ascii) return ascii;
    // 파일명이 전부 비ASCII면 짧은 해시로
    let hash = 0;
    for (const ch of filename) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `book-${hash.toString(36)}`;
  }

  static readTitle(jsonlPath) {
    const fd = fs.openSync(jsonlPath, "r");
    try {
      const buf = Buffer.alloc(4096);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const firstLine = buf.toString("utf-8", 0, n).split("\n")[0];
      return JSON.parse(firstLine).title || null;
    } catch {
      return null;
    } finally {
      fs.closeSync(fd);
    }
  }

  /** "미운 아기 오리" -> dataset/미운_아기_오리.jpg 같은 표지 파일 탐색 */
  findCover(title) {
    const candidates = [
      `${title}.jpg`,
      `${title}.png`,
      `${title.replace(/ /g, "_")}.jpg`,
      `${title.replace(/ /g, "_")}.png`
    ];
    for (const name of candidates) {
      const p = path.join(this.datasetDir, name);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  list() {
    return [...this.stories.values()];
  }

  get(id) {
    return this.stories.get(id) || null;
  }
}

module.exports = { Story, StoryRepository };
