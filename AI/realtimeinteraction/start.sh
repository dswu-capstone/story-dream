#!/usr/bin/env bash
# Story Dream 시작 (라즈베리파이 디스플레이용).
#
#   OPENAI_API_KEY=... FISH_AUDIO_API_KEY=... ./start.sh
#
# 하는 일:
#   1. 통합 앱 서버(:4000) 시작 -> camera_focus.py 자동 스폰
#   2. 파이 화면(:0)에 크로미움 키오스크 실행
#      화면 흐름: 목소리 등록(등록돼 있으면 넘어가기) -> 서재 -> 책 선택
#                 -> 나레이션 생성(버퍼링) -> 리더(+집중 감지 퀴즈)
#   3. 브라우저를 닫으면 서버/카메라도 함께 종료
#
# 옵션 env:
#   NO_BROWSER=1        키오스크 브라우저 자동 실행 끄기 (서버만)
#   FOCUS_SOURCE=browser  집중 감지 소스 (기본): 사용자 PC 웹캠을 브라우저에서 사용
#   FOCUS_SOURCE=camera   서버/파이에 연결된 카메라(camera_focus.py) 사용
#   CAMERA_FOCUS=0        (camera 모드일 때) 카메라 집중 감지 끄기
#   CHILD_NAME / CHARACTER_NAME / PORT 등은 app/README.md 참고
set -e

# ─────────────────────────────────────────────────────────────
# API 키: 아래 따옴표 안에 직접 넣어두면 매번 입력하지 않아도 된다.
# (환경변수로 넘기면 그 값이 우선한다:  OPENAI_API_KEY=... ./start.sh)
# ─────────────────────────────────────────────────────────────
OPENAI_API_KEY="${OPENAI_API_KEY:-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}"          # <- 여기에 OpenAI 키
FISH_AUDIO_API_KEY="${FISH_AUDIO_API_KEY:__pltFdrZLJrF9XqxQioTRafwajhwHyPPsFU8tdtvaEyJ}"  # <- 여기에 Fish Audio 키
export OPENAI_API_KEY FISH_AUDIO_API_KEY

cd "$(dirname "$0")/app"

PORT="${PORT:-4000}"
URL="http://localhost:${PORT}"

if [ -z "$OPENAI_API_KEY" ]; then
  echo "[warn] OPENAI_API_KEY 가 없어 퀴즈 캐릭터는 비활성화됩니다." >&2
fi
if [ -z "$FISH_AUDIO_API_KEY" ]; then
  echo "[warn] FISH_AUDIO_API_KEY 가 없어 나레이션 생성은 비활성화됩니다." >&2
fi

node server.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "$URL/api/session" && break
  sleep 0.25
done

if [ "$NO_BROWSER" = "1" ]; then
  echo "[info] NO_BROWSER=1 -> 브라우저 없이 서버만 실행 중: $URL"
  wait $SERVER_PID
  exit 0
fi

# 크로미움/크롬 바이너리 자동 탐지
BROWSER=""
for b in chromium chromium-browser google-chrome google-chrome-stable chrome; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done

if [ -z "$BROWSER" ]; then
  echo "[warn] 크로미움/크롬을 찾지 못했습니다. 서버만 실행합니다: $URL" >&2
  echo "[warn] 브라우저에서 위 주소를 직접 열거나, chromium 을 설치하세요." >&2
  wait $SERVER_PID
  exit 0
fi

echo "[info] 디스플레이에 키오스크 브라우저($BROWSER) 실행: $URL"
DISPLAY="${DISPLAY:-:0}" "$BROWSER" \
  --kiosk "$URL" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --check-for-update-interval=31536000

# 브라우저가 닫히면 trap이 서버(및 camera_focus.py)를 정리한다
