#!/usr/bin/env python3
"""LED / 엔코더 스모크 테스트.

사용법 (yolo-env 파이썬으로):
  python smoke_test.py strip      # LedStrip 직접 구동 (배선/전류 확인, 서버 불필요)
  python smoke_test.py server     # 실행 중인 LED 서버 엔드포인트 순회 (앱 흐름 흉내)
  python smoke_test.py encoder    # 엔코더 회전/버튼 동작 안내 + 버튼→LED 토글 확인

  python smoke_test.py            # strip 실행
"""

import sys
import time

BASE = "http://127.0.0.1:8765"
NUM = 60


# ---------------------------------------------------------------- strip
def test_strip():
    from led_controller import LedStrip

    YELLOW, GREEN, RED = (255, 200, 0), (0, 255, 0), (255, 0, 0)
    strip = LedStrip(NUM, brightness=0.35, colors=YELLOW)

    def step(msg, fn, wait=1.5):
        print(f"  {msg}")
        fn()
        time.sleep(wait)

    def brightness_sweep():
        for b in (0.15, 0.25, 0.35, 0.5):
            print(f"    밝기 {b}")
            strip.fill(YELLOW, b)
            time.sleep(1.5)

    print("[strip] 배선/전류 확인. Ctrl+C 로 중단.")
    try:
        step("전체 노란색 (idle)", lambda: strip.fill(YELLOW, 0.25))
        for p in (1, 3, 6, 12, 30, 60):
            step(f"진행률 {p}/{NUM} 노란색 (뒤에서부터)",
                 lambda p=p: strip.partial(p, YELLOW, 0.25, reverse=True), 0.8)
        step("퀴즈 정답 - 전체 초록", lambda: strip.fill(GREEN, 0.25))
        step("퀴즈 오답 - 전체 빨강", lambda: strip.fill(RED, 0.25))
        step("노란색 밝기 비교 (전류 부하 감 잡기)", brightness_sweep, 0)
        step("끄기", strip.clear, 0.5)
        print("[strip] 완료.")
    except KeyboardInterrupt:
        pass
    finally:
        strip.clear()


# ---------------------------------------------------------------- server
def _post(path, body=None):
    import json
    import urllib.request

    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            return json.load(r)
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def test_server():
    print(f"[server] {BASE} 순회. (led_server.py 가 먼저 떠 있어야 함)")
    seq = [
        ("power on",        "/power",    {"on": True}),
        ("idle 노랑 전체",  "/idle",     None),
        ("progress 1/10",   "/progress", {"progress": 0.1}),
        ("progress 3/10",   "/progress", {"progress": 0.3}),
        ("progress 7/10",   "/progress", {"progress": 0.7}),
        ("progress 10/10",  "/progress", {"progress": 1.0}),
        ("quiz 정답 초록",  "/quiz",     {"correct": True}),
        ("quiz 오답 빨강",  "/quiz",     {"correct": False}),
        ("idle 로 복귀",    "/idle",     None),
        ("엔코더 토글(꺼짐)", "/toggle",  None),
        ("엔코더 토글(켜짐)", "/toggle",  None),
        ("power off",       "/power",    {"on": False}),
    ]
    for label, path, body in seq:
        res = _post(path, body)
        print(f"  {label:18s} -> {res}")
        time.sleep(1.5)
    print("[server] 완료.")


# ---------------------------------------------------------------- encoder
def test_encoder():
    print("[encoder] 별도 터미널에서 엔코더 스크립트를 실행하세요:")
    print("  /home/pi/yolo-env/bin/python "
          "/home/pi/story-dream/Story-Dream/story-dream/hardware/encoder/encoder_connect.py")
    print()
    print("확인:")
    print("  1) 돌리기  -> 로그에 '음량 + xx%' / '- xx%', 실제 소리 크기 변화")
    print("  2) 누르기  -> 로그에 'LED 꺼짐' -> LED 스트립 전체 소등")
    print("  3) 다시 누르기 -> 'LED 켜짐 (idle/progress/quiz)' -> 직전 상태로 복귀")
    print()
    print("LED 서버도 떠 있어야 버튼이 동작합니다 (server 모드로 상태 만들어두고 눌러보세요).")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "strip"
    {"strip": test_strip, "server": test_server, "encoder": test_encoder}.get(
        mode, lambda: print(__doc__))()
