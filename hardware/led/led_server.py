#!/usr/bin/env python3
"""동화 앱 상태에 맞춰 WS2812 LED 60개를 제어하는 로컬 HTTP 서버.

상태(모드):
  progress : 동화 읽기 진행률만큼 앞에서부터 노란색 (10p 중 1p -> 60개 중 6개)
  quiz     : 퀴즈 정답이면 초록 60개 전체, 오답이면 빨강 60개 전체
  idle     : 그 외 항상 노란색 60개 전체 (앱 시작/홈/추천 등)

엔코더 버튼:
  POST /toggle 로 켜짐<->꺼짐 토글. 다시 켜질 때는 현재 모드(progress/quiz/idle)에
  맞는 그림을 다시 그린다.

엔드포인트:
  POST /progress {"progress": 0.0~1.0}   진행률
  POST /quiz     {"correct": true/false} 퀴즈 결과
  POST /idle                              대기(노란색 전체)
  POST /power    {"on": true/false}       앱 시작(true)/종료(false)
  POST /toggle                            엔코더 버튼: 켜짐<->꺼짐
"""

import json
import signal
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from led_controller import LedStrip

# ---------------------------------------------------------------- 설정
NUM_PIXELS = 60
HOST = "127.0.0.1"
PORT = 8765

YELLOW = (255, 200, 0)
GREEN = (0, 255, 0)
RED = (255, 0, 0)

# 전류(부하) 때문에 모든 모드 밝기를 0.25 로 고정한다.
BRIGHTNESS = 0.25

# 진행률(progress) 채우는 방향. True = 스트립 뒤(마지막)에서부터 채운다.
REVERSED = True

# ----------------------------------------------------------------
strip = LedStrip(NUM_PIXELS, BRIGHTNESS, YELLOW)
lock = threading.Lock()

# 현재 상태
STATE = {
    "mode": "idle",     # idle | progress | quiz
    "ratio": 0.0,       # progress 용 (0.0~1.0)
    "correct": True,    # quiz 용
    "on": True,         # 엔코더 버튼 토글 (False 면 전부 꺼둠)
}


def log(message):
    stamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{stamp}] {message}", flush=True)


def render():
    """STATE 에 맞춰 실제 LED 를 그린다."""
    with lock:
        if not STATE["on"]:
            strip.clear()
            return

        mode = STATE["mode"]
        if mode == "progress":
            lit = round(NUM_PIXELS * STATE["ratio"])
            strip.partial(lit, YELLOW, BRIGHTNESS, reverse=REVERSED)
        elif mode == "quiz":
            strip.fill(GREEN if STATE["correct"] else RED, BRIGHTNESS)
        else:  # idle
            strip.fill(YELLOW, BRIGHTNESS)


def describe():
    if not STATE["on"]:
        return "꺼짐(엔코더)"
    if STATE["mode"] == "progress":
        return f"progress {round(NUM_PIXELS * STATE['ratio'])}/{NUM_PIXELS} 노랑"
    if STATE["mode"] == "quiz":
        return "quiz 초록(정답)" if STATE["correct"] else "quiz 빨강(오답)"
    return "idle 노랑 전체"


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        return json.loads(self.rfile.read(length) or b"{}")

    def do_POST(self):
        routes = {
            "/progress": self._handle_progress,
            "/quiz": self._handle_quiz,
            "/idle": self._handle_idle,
            "/power": self._handle_power,
            "/toggle": self._handle_toggle,
        }
        handler = routes.get(self.path)
        if handler:
            handler()
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def _ok(self):
        self._json(200, {"ok": True, "state": describe(), "on": STATE["on"],
                         "mode": STATE["mode"]})

    def _handle_progress(self):
        try:
            ratio = float(self._read_json()["progress"])
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid body"})
            return
        STATE["mode"] = "progress"
        STATE["ratio"] = max(0.0, min(1.0, ratio))
        render()
        log(f"progress={STATE['ratio']:.3f} -> {describe()}")
        self._ok()

    def _handle_quiz(self):
        try:
            correct = bool(self._read_json()["correct"])
        except (KeyError, TypeError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid body"})
            return
        STATE["mode"] = "quiz"
        STATE["correct"] = correct
        render()
        log(f"quiz -> {describe()}")
        self._ok()

    def _handle_idle(self):
        STATE["mode"] = "idle"
        render()
        log(f"idle -> {describe()}")
        self._ok()

    def _handle_power(self):
        try:
            on = bool(self._read_json().get("on", True))
        except (TypeError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid body"})
            return
        if on:
            STATE["on"] = True
            STATE["mode"] = "idle"
            render()
        else:
            with lock:
                strip.clear()
        log(f"power={'on' if on else 'off'} -> {describe() if on else '전부 끔'}")
        self._ok()

    def _handle_toggle(self):
        STATE["on"] = not STATE["on"]
        render()
        log(f"엔코더 토글 -> {describe()}")
        self._ok()

    def log_message(self, format, *args):  # noqa: A002 - http.server 훅 시그니처
        pass


def _raise_keyboard_interrupt(*_):
    raise KeyboardInterrupt


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _raise_keyboard_interrupt)

    STATE["mode"] = "idle"
    STATE["on"] = True
    render()
    print("=" * 56, flush=True)
    print(f" LED 서버 · {NUM_PIXELS}개 · http://{HOST}:{PORT}", flush=True)
    print(" /progress /quiz /idle /power /toggle  (종료 Ctrl+C)", flush=True)
    print("=" * 56, flush=True)
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        with lock:
            strip.clear()
        print("\n모두 끄고 종료합니다.", flush=True)
