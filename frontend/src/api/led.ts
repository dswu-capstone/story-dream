// 라즈베리파이 LED 스트립(60개) 제어 요청.
// 하드웨어가 없는 개발 환경에서도 앱이 막히면 안 되므로 실패는 조용히 무시한다.
// 요청은 vite 프록시(/led-api → http://localhost:8765)를 거쳐 LED 서버로 간다.

const ledApiBase = "/led-api";

function post(path: string, body: unknown, keepalive = false) {
  void fetch(`${ledApiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  }).catch(() => undefined);
}

// 앱 시작(on=true) / 종료(on=false). 종료 직전에도 나가도록 keepalive.
export function sendLedPower(on: boolean) {
  post("/power", { on }, true);
}

// 동화 읽기 진행률 (0.0~1.0). 예) 10p 중 1p → 0.1 → 60개 중 6개 노란색.
export function sendLedProgress(ratio: number) {
  post("/progress", { progress: Math.max(0, Math.min(1, ratio)) });
}

// 퀴즈 결과. true → 초록 60개 전체, false → 빨강 60개 전체.
export function sendLedQuiz(correct: boolean) {
  post("/quiz", { correct });
}

// 그 외 기본 상태: 노란색 60개 전체.
export function sendLedIdle() {
  post("/idle", {});
}
