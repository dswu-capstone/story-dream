#!/usr/bin/env python3
"""KY-040 엔코더. 돌리면 시스템 음량 조절, 누르면 LED 켜짐/꺼짐 토글.

- 음량: PipeWire(wpctl) 사용
- LED : 로컬 LED 서버(http://127.0.0.1:8765/toggle) 에 요청

배선:
  모듈 +    -> 물리 1번  (3V3)
  모듈 GND  -> 물리 6번  (GND)
  모듈 CLK  -> 물리 11번 (GPIO 17)
  모듈 DT   -> 물리 13번 (GPIO 27)
  모듈 SW   -> 물리 15번 (GPIO 22)
"""

import json
import subprocess
import sys
import threading
import time
import urllib.request
from datetime import datetime
from signal import pause

from gpiozero import Button, RotaryEncoder

CLK_PIN, DT_PIN, SW_PIN = 17, 27, 22
STEP = 0.05
SETTLE = 0.05
SINK = "@DEFAULT_AUDIO_SINK@"
LED_TOGGLE_URL = "http://127.0.0.1:8765/toggle"
PRESS_COOLDOWN = 0.5   # 이 시간 안에 또 눌린 건 채터링으로 보고 무시(초)


def log(tag, message):
    stamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{stamp}] {tag:<4} {message}", flush=True)


def run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=5)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return subprocess.CompletedProcess(cmd, 1, "", "")


def fmt(value):
    return f"{int(round(value * 100))}%"


def read_volume():
    for token in run(["wpctl", "get-volume", SINK]).stdout.split():
        try:
            return float(token)
        except ValueError:
            continue
    return 0.5


def write_volume(value):
    run(["wpctl", "set-volume", SINK, f"{value:.2f}"])


def led_toggle():
    """LED 서버에 켜짐/꺼짐 토글 요청. 서버가 없으면 조용히 무시."""
    try:
        req = urllib.request.Request(
            LED_TOGGLE_URL, data=b"{}", method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return json.load(resp)
    except Exception:
        return None


class VolumeEncoder:
    """돌리면 음량 조절, 누르면 LED 켜짐/꺼짐 토글.

    step: 한 칸 돌릴 때마다 바뀌는 음량 비율 (0.05 = 5%)
    settle: 빠르게 여러 칸 돌렸을 때 마지막 입력 뒤 실제로 반영하기까지 대기 시간(초)
    """

    def __init__(self, clk_pin, dt_pin, sw_pin, step=0.05, settle=0.05):
        self.step = step
        self.settle = settle

        self.level = max(0.0, min(1.0, read_volume()))
        self._last_steps = 0
        self._pending = 0
        self._lock = threading.Lock()
        self._timer = None
        self._last_press = 0.0

        self.enc = RotaryEncoder(clk_pin, dt_pin, max_steps=0, bounce_time=0.01)
        self.btn = Button(sw_pin, pull_up=True, bounce_time=0.15, hold_time=10)
        self.enc.when_rotated = self._on_rotate
        self.btn.when_pressed = self._on_press

    def _apply_pending(self):
        with self._lock:
            delta, self._pending = self._pending, 0
        if delta == 0:
            return

        old = self.level
        new = max(0.0, min(1.0, old + delta * self.step))
        if abs(new - old) < 0.001:
            log("음량", f"{fmt(old)}  (한계값)")
            return

        self.level = new
        write_volume(new)
        arrow = "+" if new > old else "-"
        log("음량", f"{arrow} {fmt(new)}")

    def _on_rotate(self):
        steps = self.enc.steps
        delta = steps - self._last_steps
        self._last_steps = steps
        if delta == 0:
            return
        with self._lock:
            self._pending += delta
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self.settle, self._apply_pending)
            self._timer.start()

    def _on_press(self):
        # KY-040 스위치는 채터링이 심해 한 번 눌러도 콜백이 여러 번 뜬다.
        # PRESS_COOLDOWN 안에 다시 온 건 무시해서 "한 번 눌렀을 때 한 번만 토글".
        now = time.monotonic()
        if now - self._last_press < PRESS_COOLDOWN:
            return
        self._last_press = now
        # HTTP 요청이 콜백 스레드를 붙잡지 않도록 별도 스레드에서 보낸다.
        threading.Thread(target=self._do_toggle, daemon=True).start()

    def _do_toggle(self):
        result = led_toggle()
        if result is None:
            log("LED", "토글 실패 — LED 서버(8765) 떠 있는지 확인")
        elif result.get("on"):
            log("LED", f"켜짐 ({result.get('mode')})")
        else:
            log("LED", "꺼짐")

    def run(self):
        """포그라운드에서 계속 실행하며 이벤트를 기다린다. Ctrl+C 로 종료."""
        print("=" * 52, flush=True)
        print(" 엔코더 컨트롤러", flush=True)
        print(f" 음량: 현재 {fmt(self.level)}", flush=True)
        print(" 돌리면 음량 조절, 누르면 LED 켜짐/꺼짐 (Ctrl+C 종료)", flush=True)
        print("=" * 52, flush=True)

        try:
            pause()
        except KeyboardInterrupt:
            print(f"\n종료합니다. 최종 음량: {fmt(self.level)}", flush=True)


if __name__ == "__main__":
    if run(["wpctl", "get-volume", SINK]).returncode != 0:
        # 음량 제어는 안 되지만 버튼(LED 토글)은 계속 쓸 수 있으니 종료하지 않는다.
        print("[경고] wpctl 로 음량 제어 불가 (PipeWire 확인). 버튼(LED)만 동작합니다.", flush=True)

    try:
        encoder = VolumeEncoder(CLK_PIN, DT_PIN, SW_PIN, step=STEP, settle=SETTLE)
    except Exception as exc:  # GPIO 사용 불가 등
        print(f"[에러] 엔코더 초기화 실패: {exc}", flush=True)
        sys.exit(1)
    encoder.run()
