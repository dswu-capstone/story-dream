#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

load_env_file() {
  local file="$1" line key val
  [ -f "$file" ] || return 1

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"                              # 윈도우 개행 제거
    line="${line#"${line%%[![:space:]]*}"}"           # 앞 공백 제거
    line="${line%"${line##*[![:space:]]}"}"           # 뒤 공백 제거

    [ -z "$line" ] && continue
    [ "${line:0:1}" = "#" ] && continue

    line="${line#export }"
    case "$line" in *=*) ;; *) continue ;; esac

    key="${line%%=*}"
    val="${line#*=}"
    key="${key//[[:space:]]/}"

    # 유효한 변수명이 아니면 무시
    case "$key" in
      [A-Za-z_]*) ;;
      *) continue ;;
    esac

    val="${val#"${val%%[![:space:]]*}"}"              # 값 앞 공백 제거
    case "$val" in
      \"*) val="${val#\"}"; val="${val%%\"*}" ;;      # "값"  # 주석
      \'*) val="${val#\'}"; val="${val%%\'*}" ;;      # '값'  # 주석
      *)   val="${val%%#*}"                           # 값 # 주석
           val="${val%"${val##*[![:space:]]}"}" ;;
    esac

    [ -z "$val" ] && continue
    if [ -n "${!key:-}" ]; then continue; fi          # 환경변수 우선

    export "$key=$val"
  done < "$file"
}

if load_env_file "$ENV_FILE"; then
  echo "[info] .env 로드: $ENV_FILE"
else
  echo "[warn] .env 를 찾지 못했습니다: $ENV_FILE" >&2
  echo "[warn] 예시)  OPENAI_API_KEY=sk-proj-xxxx" >&2
fi

# 값이 셸 문법/플레이스홀더로 남아있으면 경고
check_key() {
  local name="$1" v="${!1:-}"
  case "$v" in
    *'${'*|*'<-'*|'{}'|'여기'*)
      echo "[warn] $name 값이 실제 키가 아닌 것 같습니다: '$v'" >&2
      echo "[warn] .env 에는 따옴표/치환 없이 '$name=실제키' 형태로 적어주세요." >&2
      ;;
  esac
}
check_key OPENAI_API_KEY
check_key FISH_AUDIO_API_KEY

cd "$ROOT_DIR/app"

PORT="${PORT:-4000}"
URL="http://localhost:${PORT}"

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "[warn] OPENAI_API_KEY 가 없어 퀴즈 캐릭터는 비활성화됩니다." >&2
fi
if [ -z "${FISH_AUDIO_API_KEY:-}" ]; then
  echo "[warn] FISH_AUDIO_API_KEY 가 없어 나레이션 생성은 비활성화됩니다." >&2
fi

node server.js & # Node 서버 실행
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "$URL/api/session" && break
  sleep 0.25
done

if [ "${NO_BROWSER:-}" = "1" ]; then
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
