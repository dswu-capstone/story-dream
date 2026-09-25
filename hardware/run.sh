#!/usr/bin/env bash
# LED 서버 + 엔코더를 한꺼번에 띄워서 실험한다. (앱 없이)
# Ctrl+C 로 둘 다 정리하고 LED 도 끈다.
set -u

HW_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PY="$HOME/yolo-env/bin/python"
[ -x "$PY" ] || PY="$(command -v python3)"

LED_PID=""
ENC_PID=""

cleanup() {
  echo
  echo "정리 중..."
  [ -n "$ENC_PID" ] && kill "$ENC_PID" 2>/dev/null
  [ -n "$LED_PID" ] && kill "$LED_PID" 2>/dev/null   # SIGTERM -> LED 서버가 스트립 끄고 종료
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# 이전 인스턴스 정리
pkill -f "hardware/led/led_server.py" 2>/dev/null || true
pkill -f "hardware/encoder/encoder_connect.py" 2>/dev/null || true
sleep 1

echo "== LED 서버 =="
"$PY" "$HW_DIR/led/led_server.py" &
LED_PID=$!
sleep 1.5

echo "== 엔코더 =="
"$PY" "$HW_DIR/encoder/encoder_connect.py" &
ENC_PID=$!

echo
echo "-----------------------------------------------------------"
echo " 실험:"
echo "   * 엔코더 돌리기       -> 음량 +/-"
echo "   * 엔코더 누르기       -> LED 전체 off/on 토글"
echo "   * 상태 바꿔보기 (다른 터미널):"
echo "       curl -s localhost:8765/progress -d '{\"progress\":0.3}'"
echo "       curl -s localhost:8765/quiz     -d '{\"correct\":true}'"
echo "       curl -s localhost:8765/quiz     -d '{\"correct\":false}'"
echo "       curl -s localhost:8765/idle     -d '{}'"
echo " 종료: Ctrl+C"
echo "-----------------------------------------------------------"

# 둘 중 하나라도 죽으면 같이 정리
wait -n "$LED_PID" "$ENC_PID"
cleanup
