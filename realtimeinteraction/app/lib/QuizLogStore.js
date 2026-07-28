/**
 * QuizLogStore — 퀴즈 결과(질문/대답/정오답) 저장.
 * 지금은 append-only jsonl 파일, 웹서버 DB 연동 시 이 클래스만 교체하면 된다.
 */

const fs = require("fs");
const path = require("path");

class QuizLogStore {
  constructor({ file }) {
    this.file = file;
  }

  append(entry, context = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      ...context, // bookId / level / page 등 세션 컨텍스트
      ...entry
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(record) + "\n", "utf-8");
    return record;
  }
}

module.exports = { QuizLogStore };
