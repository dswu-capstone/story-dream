/**
 * ApiClient — 서버 REST API 래퍼.
 * 나중에 웹서버/DB로 옮길 때 base URL·인증만 여기서 바꾸면 된다.
 */

export class ApiClient {
  constructor(base = "") {
    this.base = base;
  }

  async get(path) {
    const res = await fetch(this.base + path);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || `GET ${path} failed`);
    return data;
  }

  async post(path, body) {
    const res = await fetch(this.base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || `POST ${path} failed`);
    return data;
  }

  async postBinary(path, blob) {
    const res = await fetch(this.base + path, {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || `POST ${path} failed`);
    return data;
  }

  // --- session / flow ---
  session() {
    return this.get("/api/session");
  }

  // --- voice enrollment ---
  voicePrompts() {
    return this.get("/api/voice/prompts");
  }
  saveRecording(index, blob) {
    return this.postBinary(`/api/voice/recordings?index=${index}`, blob);
  }
  resetVoice() {
    return this.post("/api/voice/reset");
  }
  finalizeVoice() {
    return this.post("/api/voice/finalize");
  }

  // --- library / narration ---
  books() {
    return this.get("/api/books");
  }
  startNarration(bookId) {
    return this.post(`/api/books/${bookId}/narration`);
  }
  narrationStatus(bookId) {
    return this.get(`/api/books/${bookId}/narration`);
  }

  // --- reading ---
  openBook(bookId) {
    return this.post(`/api/books/${bookId}/open`);
  }
  closeSession() {
    return this.post("/api/session/close");
  }
  state() {
    return this.get("/api/state");
  }
  setState(patch) {
    return this.post("/api/state", patch);
  }

  // --- quiz / realtime ---
  quizLog(entry) {
    return this.post("/api/quiz-log", entry).catch(() => {});
  }
  call(sdp) {
    return this.post("/api/call", { sdp });
  }

  // --- browser 웹캠 집중 감지 ---
  detectPose(imageBase64) {
    return this.post("/api/detect-pose", { image: imageBase64 });
  }
  focusSignal(signal) {
    return this.post("/api/focus", signal).catch(() => {});
  }
}
