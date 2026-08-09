// 화면 안의 X 버튼이 앱을 종료할 수 있게 해주는 아주 작은 제어 서버.
//
// 브라우저 페이지는 스스로 창을 닫을 수 없기 때문에(window.close 는 스크립트가
// 연 창에만 동작), 런처가 이 서버를 같이 띄워두고 X 버튼이 여기에 요청을 보내면
// 브라우저 프로세스를 종료시킨다. 그러면 런처의 trap 이 vite 서버까지 정리한다.
//
// 127.0.0.1 에만 바인딩하므로 라즈베리파이 바깥에서는 접근할 수 없다.

import http from "node:http";

const PORT = Number(process.env.SD_QUIT_PORT || 5174);
const BROWSER_PID = Number(process.env.SD_BROWSER_PID || 0);

function killBrowser() {
  if (!BROWSER_PID) return;
  try {
    process.kill(BROWSER_PID, "SIGTERM");
  } catch {
    /* 이미 종료됨 */
  }
  // 3초 안에 안 죽으면 강제 종료
  setTimeout(() => {
    try {
      process.kill(BROWSER_PID, "SIGKILL");
    } catch {
      /* 이미 종료됨 */
    }
    process.exit(0);
  }, 3000).unref();
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, browserPid: BROWSER_PID }));
    return;
  }

  if (path === "/quit") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    // 응답이 실제로 나간 뒤에 종료시킨다.
    setTimeout(killBrowser, 150);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});

server.on("error", (err) => {
  console.error("[quit-server] 시작 실패:", err.message);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[quit-server] http://127.0.0.1:${PORT} (browser pid=${BROWSER_PID})`);
});
