/**
 * SseHub — Server-Sent Events 허브.
 * 브라우저 클라이언트를 등록하고 상태 변화를 push한다.
 * (웹서버 연동 시 WebSocket/메시지 브로커로 교체하는 지점)
 */

class SseHub {
  constructor() {
    this.clients = new Set();
  }

  /** SSE 연결을 수락. onConnect(send)로 초기 스냅샷을 재전송할 수 있다. */
  handle(req, res, onConnect) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write("\n");
    this.clients.add(res);
    if (onConnect) {
      onConnect((event, data) => SseHub.send(res, event, data));
    }
    req.on("close", () => this.clients.delete(res));
  }

  broadcast(event, data) {
    for (const client of this.clients) {
      SseHub.send(client, event, data);
    }
  }

  static send(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

module.exports = { SseHub };
