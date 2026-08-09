#!/usr/bin/env bash
# Story Dream 런처 (라즈베리파이용)
#   1) vite 서버를 백그라운드로 띄우고
#   2) 포트가 열릴 때까지 기다린 뒤
#   3) 브라우저를 전체화면으로 열고
#   4) 브라우저가 닫히면 서버까지 같이 정리한다.
set -uo pipefail

RPI_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$RPI_DIR/.." && pwd)"

# ---------------------------------------------------------------- 설정 읽기
# 아래 값들은 ~/.config/story-dream/launcher.env 에서 덮어쓸 수 있다.
CONF="${XDG_CONFIG_HOME:-$HOME/.config}/story-dream/launcher.env"
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

MODE="${SD_MODE:-dev}"          # dev = npm run dev, preview = 빌드 후 정적 서빙
HOST="${SD_HOST:-127.0.0.1}"
PORT="${SD_PORT:-5173}"
KIOSK="${SD_KIOSK:-1}"          # 1 = 전체화면(키오스크), 0 = 일반 창
ROUTE="${SD_ROUTE:-/}"          # 처음 띄울 경로
BLANK_OFF="${SD_DISABLE_BLANK:-1}"  # 1 = 화면 절전/블랭킹 끄기
QUIT_PORT="${SD_QUIT_PORT:-5174}"   # 화면 안 X 버튼이 종료 요청을 보내는 포트
EXIT_CONFIRM="${SD_EXIT_CONFIRM:-1}"  # 1 = X 버튼에 확인창, 0 = 바로 종료
ON_EXIT="${SD_ON_EXIT:-desktop}"    # desktop = 바탕화면 복귀, poweroff, reboot
STATE_DIR="${SD_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/story-dream}"

URL="http://${HOST}:${PORT}${ROUTE}"
# 키오스크일 때만 화면 안 X 버튼을 켠다(일반 브라우저에서는 안 보이게).
if [ "$KIOSK" = "1" ]; then
  case "$ROUTE" in
    *\?*) URL="${URL}&kiosk=1" ;;
    *)    URL="${URL}?kiosk=1" ;;
  esac
  URL="${URL}&quitPort=${QUIT_PORT}&kioskConfirm=${EXIT_CONFIRM}"
fi
LOG="$STATE_DIR/launcher.log"
SERVER_LOG="$STATE_DIR/server.log"
LOCK="$STATE_DIR/launcher.lock"
BROWSER_PROFILE="$STATE_DIR/browser-profile"

mkdir -p "$STATE_DIR"
exec > >(tee -a "$LOG") 2>&1
echo "===== $(date '+%F %T') 시작 (mode=$MODE url=$URL) ====="

# ---------------------------------------------------------------- 유틸
die() {
  echo "[에러] $*"
  if command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Story Dream" \
      --text="$1\n\n자세한 내용: $LOG" --width=420 2>/dev/null || true
  fi
  exit 1
}

notify() {
  command -v zenity >/dev/null 2>&1 || return 0
  # 서버 뜨는 동안 보여줄 안내창 (준비되면 kill 한다)
  zenity --info --title="Story Dream" --text="$1" --width=320 2>/dev/null &
  SPLASH_PID=$!
}

port_open() {
  (exec 3<>"/dev/tcp/${HOST}/${PORT}") 2>/dev/null && exec 3>&- && return 0
  return 1
}

# ---------------------------------------------------------------- 중복 실행 방지
# 이미 떠 있으면 서버는 그대로 두고 브라우저만 다시 연다.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "런처가 이미 실행 중입니다. 브라우저만 다시 엽니다."
  ALREADY_RUNNING=1
else
  ALREADY_RUNNING=0
fi

# ---------------------------------------------------------------- node PATH 확보
# .desktop 으로 실행하면 ~/.bashrc 를 안 읽어서 nvm 계열 node 가 PATH 에 없다.
if ! command -v npm >/dev/null 2>&1; then
  for cand in "$HOME/.nvm/nvm.sh" "/usr/local/nvm/nvm.sh"; do
    if [ -s "$cand" ]; then
      # shellcheck disable=SC1090
      . "$cand" >/dev/null 2>&1
      break
    fi
  done
fi
export PATH="/usr/local/bin:/usr/bin:$PATH"
command -v npm >/dev/null 2>&1 || die "npm 을 찾을 수 없습니다. Node.js 를 먼저 설치하세요."

# ---------------------------------------------------------------- 서버 기동
SERVER_PID=""

start_server() {
  cd "$APP_DIR" || die "프로젝트 폴더를 찾을 수 없습니다: $APP_DIR"

  if [ ! -d node_modules ]; then
    echo "node_modules 가 없어 npm ci 를 먼저 실행합니다 (몇 분 걸릴 수 있음)."
    notify "처음 실행이라 패키지를 설치하는 중입니다.\n몇 분 정도 걸릴 수 있어요."
    npm ci >>"$SERVER_LOG" 2>&1 || die "npm ci 에 실패했습니다."
    [ -n "${SPLASH_PID:-}" ] && kill "$SPLASH_PID" 2>/dev/null
    unset SPLASH_PID
  fi

  if [ "$MODE" = "preview" ]; then
    echo "빌드 중..."
    npm run build >>"$SERVER_LOG" 2>&1 || die "빌드에 실패했습니다."
    npm run preview -- --host "$HOST" --port "$PORT" --strictPort \
      >>"$SERVER_LOG" 2>&1 &
  else
    npm run dev -- --host "$HOST" --port "$PORT" --strictPort \
      >>"$SERVER_LOG" 2>&1 &
  fi
  SERVER_PID=$!
  echo "서버 시작 (pid=$SERVER_PID), 로그: $SERVER_LOG"
}

# 종료 후 화면이 까맣게 남는 것을 막는다.
# 크로미움이 끄고 나간 화면/절전 상태를 세션 종류에 맞춰 되살린다.
wake_screen() {
  if [ -n "${WAYLAND_DISPLAY:-}" ]; then
    command -v wlopm >/dev/null 2>&1 && wlopm --on '*' 2>/dev/null
    command -v swaymsg >/dev/null 2>&1 && swaymsg output '*' dpms on 2>/dev/null
  fi
  if [ -n "${DISPLAY:-}" ] && command -v xset >/dev/null 2>&1; then
    xset dpms force on 2>/dev/null
    xset s reset 2>/dev/null
    # 앱 실행 중 꺼뒀던 블랭킹을 기본값으로 되돌린다.
    xset s on 2>/dev/null
    xset +dpms 2>/dev/null
  fi
  # 바탕화면을 그리는 프로세스가 없으면 화면이 검게 남는다. 있으면 살려둔다.
  if [ "$ON_EXIT" = "desktop" ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    if ! pgrep -x pcmanfm >/dev/null 2>&1 && command -v pcmanfm >/dev/null 2>&1; then
      echo "바탕화면 프로세스가 없어 pcmanfm --desktop 을 다시 띄웁니다."
      (setsid pcmanfm --desktop >/dev/null 2>&1 &) || true
    fi
  fi
}

cleanup() {
  [ -n "${SPLASH_PID:-}" ] && kill "$SPLASH_PID" 2>/dev/null
  if [ -n "${QUIT_PID:-}" ] && kill -0 "$QUIT_PID" 2>/dev/null; then
    kill -TERM "$QUIT_PID" 2>/dev/null
  fi
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "서버 종료 중 (pid=$SERVER_PID)"
    # vite 는 npm 의 자식이라 프로세스 그룹째 정리한다.
    kill -TERM -- "-$(ps -o pgid= "$SERVER_PID" | tr -d ' ')" 2>/dev/null \
      || kill -TERM "$SERVER_PID" 2>/dev/null
    for _ in $(seq 1 20); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL "$SERVER_PID" 2>/dev/null
  fi
  wake_screen
}
trap cleanup EXIT INT TERM

if [ "$ALREADY_RUNNING" = "0" ] && ! port_open; then
  : >"$SERVER_LOG"
  start_server
  notify "잠시만 기다려 주세요.\n앱을 준비하는 중입니다..."

  # 최대 180초 대기 (라즈베리파이는 첫 기동이 느리다)
  READY=0
  for _ in $(seq 1 360); do
    if port_open; then READY=1; break; fi
    if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      die "서버가 시작되자마자 종료됐습니다. 로그를 확인하세요: $SERVER_LOG"
    fi
    sleep 0.5
  done
  [ -n "${SPLASH_PID:-}" ] && kill "$SPLASH_PID" 2>/dev/null
  unset SPLASH_PID
  [ "$READY" = "1" ] || die "서버가 ${PORT} 포트에서 열리지 않았습니다."
else
  echo "이미 서버가 떠 있습니다. 그대로 사용합니다."
fi

# ---------------------------------------------------------------- 화면 절전 끄기
if [ "$BLANK_OFF" = "1" ] && [ -n "${DISPLAY:-}" ] && command -v xset >/dev/null 2>&1; then
  xset s off -dpms 2>/dev/null || true
  xset s noblank 2>/dev/null || true
fi

# ---------------------------------------------------------------- 브라우저 실행
BROWSER=""
for b in chromium-browser chromium google-chrome chromium-freeworld firefox-esr firefox; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done
[ -n "$BROWSER" ] || die "브라우저를 찾을 수 없습니다. sudo apt install chromium-browser 로 설치하세요."

echo "브라우저 실행: $BROWSER"
case "$BROWSER" in
  firefox*)
    if [ "$KIOSK" = "1" ]; then
      "$BROWSER" --kiosk "$URL" &
    else
      "$BROWSER" "$URL" &
    fi
    ;;
  *)
    # 크래시 복원 팝업/업데이트 안내 등 키오스크에 방해되는 UI 를 모두 끈다.
    CHROME_ARGS=(
      --user-data-dir="$BROWSER_PROFILE"
      --noerrdialogs
      --disable-infobars
      --disable-session-crashed-bubble
      --disable-features=TranslateUI
      --check-for-update-interval=31536000
      --autoplay-policy=no-user-gesture-required
      --disable-pinch
      --overscroll-history-navigation=0
    )
    if [ "$KIOSK" = "1" ]; then
      CHROME_ARGS+=(--kiosk --start-fullscreen "--app=$URL")
    else
      CHROME_ARGS+=("$URL")
    fi
    "$BROWSER" "${CHROME_ARGS[@]}" &
    ;;
esac
BROWSER_PID=$!
echo "브라우저 pid=$BROWSER_PID"

# ------------------------------------------------- 화면 안 X 버튼용 제어 서버
# 페이지는 자기 창을 닫을 수 없으므로, X 버튼이 여기로 요청을 보내면
# 이 서버가 브라우저를 종료시키고 → 아래 wait 이 풀리며 → trap 이 뒷정리한다.
if [ "$KIOSK" = "1" ] && command -v node >/dev/null 2>&1; then
  SD_QUIT_PORT="$QUIT_PORT" SD_BROWSER_PID="$BROWSER_PID" \
    node "$RPI_DIR/quit-server.mjs" >>"$STATE_DIR/quit-server.log" 2>&1 &
  QUIT_PID=$!
  echo "종료 제어 서버 pid=$QUIT_PID (포트 $QUIT_PORT)"
fi

wait "$BROWSER_PID"
echo "브라우저가 종료되었습니다."

# trap(cleanup) 이 서버 정리와 화면 복구를 처리한다.
case "$ON_EXIT" in
  poweroff) echo "라즈베리파이를 종료합니다."; cleanup; trap - EXIT; systemctl poweroff ;;
  reboot)   echo "라즈베리파이를 재시작합니다."; cleanup; trap - EXIT; systemctl reboot ;;
esac
