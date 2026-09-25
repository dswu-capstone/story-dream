#!/usr/bin/env bash
# Story Dream 런처 (라즈베리파이용)
#   1) vite 서버 + LED/엔코더 하드웨어 스크립트를 백그라운드로 띄우고
#   2) 포트가 열릴 때까지 기다린 뒤
#   3) 브라우저를 전체화면으로 열고
#   4) 브라우저가 닫히면 띄운 것들을 같이 정리한다.
set -uo pipefail

RPI_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$RPI_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$APP_DIR/.." && pwd)"
HARDWARE_DIR="$PROJECT_DIR/hardware"
# LED/엔코더는 gpiozero, board, neopixel_spi 가 설치된 파이썬이 있어야 한다.
PY_HW="$HOME/yolo-env/bin/python"
[ -x "$PY_HW" ] || PY_HW="$(command -v python3 || true)"

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

ENABLE_LED="${SD_ENABLE_LED:-1}"           # 1 = LED 진행률/전원 서버도 같이 띄움
ENABLE_ENCODER="${SD_ENABLE_ENCODER:-1}"   # 1 = 엔코더 음량 스크립트도 같이 띄움
ENABLE_INTERACTION="${SD_ENABLE_INTERACTION:-1}"  # 1 = 카메라 집중감지/실시간 상호작용 서버(4000)
LED_PORT="${SD_LED_PORT:-8765}"
INTERACTION_PORT="${SD_INTERACTION_PORT:-4000}"

OSK="${SD_OSK:-1}"                          # 1 = 화면 키보드도 같이 띄움 (X11=onboard, Wayland=squeekboard)
WL_BROWSER="${SD_WAYLAND_BROWSER:-auto}"    # auto = Wayland 세션이면 크로미움도 Wayland 네이티브로,
                                           # 0 = 항상 XWayland, 1 = 항상 Wayland

# ---------------------------------------------------------------- 세션 종류 감지
# 런처가 .desktop 으로 뜨면 WAYLAND_DISPLAY 가 비어 있을 수 있어 세션 타입/소켓/
# 컴포지터 프로세스까지 같이 본다. (이 파이는 Wayland(labwc) ↔ X11(LXDE) 를 오갈 수 있음)
IS_WAYLAND=0
_wl_sock="$(ls "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"/wayland-[0-9]* 2>/dev/null | head -1)"
if [ -n "${WAYLAND_DISPLAY:-}" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ] \
   || [ -n "$_wl_sock" ] || pgrep -x "labwc|wayfire|sway|weston" >/dev/null 2>&1; then
  IS_WAYLAND=1
  : "${XDG_RUNTIME_DIR:=/run/user/$(id -u)}"
  export XDG_RUNTIME_DIR
  [ -n "${WAYLAND_DISPLAY:-}" ] || WAYLAND_DISPLAY="$(basename "${_wl_sock:-wayland-0}")"
  export WAYLAND_DISPLAY
fi
# X11 세션이면 DISPLAY 를 최소한 :0 으로라도 채운다 (onboard/xset 용).
[ "$IS_WAYLAND" = "1" ] || : "${DISPLAY:=:0}"
[ "$IS_WAYLAND" = "1" ] || export DISPLAY

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

tcp_open() {
  (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null && exec 3>&- && return 0
  return 1
}

port_open() { tcp_open "$HOST" "$PORT"; }

# ---------------------------------------------------------------- 중복 실행 방지
# 이미 다른 런처가 돌고 있으면 서버는 그대로 두고 브라우저만 다시 연다.
# (flock 은 백그라운드 자식 프로세스가 fd 를 물려받아 락이 안 풀리는 문제가 있어 PID 파일로.)
PIDFILE="$STATE_DIR/launcher.pid"
_other="$(cat "$PIDFILE" 2>/dev/null || true)"
if [ -n "$_other" ] && [ "$_other" != "$$" ] && kill -0 "$_other" 2>/dev/null \
   && tr '\0' ' ' < "/proc/$_other/cmdline" 2>/dev/null | grep -q "story-dream-launch"; then
  echo "런처가 이미 실행 중입니다(pid=$_other). 브라우저만 다시 엽니다."
  ALREADY_RUNNING=1
else
  ALREADY_RUNNING=0
  echo $$ > "$PIDFILE"
  # 예전 flock 방식이 남긴 잠금 파일을 붙잡고 있는 유령 프로세스 정리 흔적 제거
  rm -f "$LOCK" 2>/dev/null || true
  # 우리가 유일한 런처인데 이전 실행이 비정상 종료돼 크로미움이 남아 있으면,
  # 새로 띄운 크로미움이 "Opening in existing browser session" 하고 바로 끝나버려
  # 런처가 브라우저가 닫힌 줄 알고 서버까지 정리해 버린다. 남은 인스턴스를 먼저 정리한다.
  if pgrep -f -- "--user-data-dir=$BROWSER_PROFILE" >/dev/null 2>&1; then
    echo "이전 크로미움 인스턴스가 남아 있어 정리합니다."
    pkill -f -- "--user-data-dir=$BROWSER_PROFILE" 2>/dev/null || true
    for _ in $(seq 1 20); do
      pgrep -f -- "--user-data-dir=$BROWSER_PROFILE" >/dev/null 2>&1 || break
      sleep 0.25
    done
    pkill -9 -f -- "--user-data-dir=$BROWSER_PROFILE" 2>/dev/null || true
    rm -f "$BROWSER_PROFILE/Singleton"* 2>/dev/null || true
  fi
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

# ---------------------------------------------------------------- 하드웨어 스크립트 기동
LED_PID=""
ENCODER_PID=""

start_led_server() {
  [ "$ENABLE_LED" = "1" ] || return
  if tcp_open 127.0.0.1 "$LED_PORT"; then
    echo "LED 서버가 이미 ${LED_PORT} 포트에 떠 있습니다."
    return
  fi
  if [ -z "$PY_HW" ] || [ ! -x "$PY_HW" ] || [ ! -f "$HARDWARE_DIR/led/led_server.py" ]; then
    echo "[경고] LED 서버용 파이썬/스크립트를 못 찾아 건너뜁니다."
    return
  fi
  "$PY_HW" "$HARDWARE_DIR/led/led_server.py" >>"$STATE_DIR/led.log" 2>&1 &
  LED_PID=$!
  echo "LED 서버 시작 (pid=$LED_PID), 로그: $STATE_DIR/led.log"
}

start_encoder() {
  [ "$ENABLE_ENCODER" = "1" ] || return
  if pgrep -f "encoder/encoder_connect.py" >/dev/null 2>&1; then
    echo "엔코더 스크립트가 이미 떠 있습니다."
    return
  fi
  if [ -z "$PY_HW" ] || [ ! -x "$PY_HW" ] || [ ! -f "$HARDWARE_DIR/encoder/encoder_connect.py" ]; then
    echo "[경고] 엔코더용 파이썬/스크립트를 못 찾아 건너뜁니다."
    return
  fi
  "$PY_HW" "$HARDWARE_DIR/encoder/encoder_connect.py" >>"$STATE_DIR/encoder.log" 2>&1 &
  ENCODER_PID=$!
  echo "엔코더 스크립트 시작 (pid=$ENCODER_PID), 로그: $STATE_DIR/encoder.log"
}

INTERACTION_PID=""

# 이전 실행이 비정상 종료돼 남은 하드웨어/AI 프로세스를 정리한다.
# (앱을 껐다 켰을 때 pose_worker 나 서버가 중복으로 돌면 CPU/카메라를 두 배로 먹는다)
cleanup_orphans() {
  local n=0
  for pat in "app/pose_worker.py" "realtimeinteraction/app/server.js"; do
    for pid in $(pgrep -f "$pat" 2>/dev/null); do
      [ "$pid" = "$$" ] && continue
      kill "$pid" 2>/dev/null && n=$((n+1))
    done
  done
  [ "$n" -gt 0 ] && { echo "이전 실행에서 남은 프로세스 ${n}개 정리."; sleep 1; }
  return 0
}

start_interaction() {
  [ "$ENABLE_INTERACTION" = "1" ] || return
  local dir="$PROJECT_DIR/AI/realtimeinteraction/app"
  [ -f "$dir/server.js" ] || { echo "[경고] 상호작용 서버 스크립트 없음, 건너뜁니다."; return; }
  command -v node >/dev/null 2>&1 || { echo "[경고] node 없음, 상호작용 서버 건너뜁니다."; return; }
  if tcp_open 127.0.0.1 "$INTERACTION_PORT"; then
    echo "상호작용 서버가 이미 ${INTERACTION_PORT} 포트에 떠 있습니다."
    return
  fi
  # .env (OPENAI_API_KEY 등) 로드
  local env_file="$PROJECT_DIR/AI/realtimeinteraction/.env"
  # YOLO 추론이 4코어를 다 먹으면 브라우저/오디오가 끊기므로 우선순위를 낮추고
  # 추론 스레드도 제한한다(POSE_THREADS).
  ( cd "$dir"
    [ -f "$env_file" ] && { set -a; . "$env_file" 2>/dev/null; set +a; }
    PORT="$INTERACTION_PORT" FOCUS_SOURCE="${SD_FOCUS_SOURCE:-browser}" \
    POSE_THREADS="${SD_POSE_THREADS:-2}" \
      exec nice -n 10 node server.js
  ) >>"$STATE_DIR/interaction.log" 2>&1 &
  INTERACTION_PID=$!
  echo "상호작용 서버 시작 (pid=$INTERACTION_PID, 포트 $INTERACTION_PORT), 로그: $STATE_DIR/interaction.log"
}

# ---------------------------------------------------------------- 오디오 준비
# 이 패널(MPI7002)은 HDMI 로 오디오를 받으면 HDMI 링크 전체가 끊긴다(화면까지 죽음).
# 그래서 HDMI 오디오는 끄고 파이의 3.5mm 잭으로만 소리를 낸다.
# 부팅 때 프로파일이 off 로 시작하는 경우가 있어 앱 시작 시 매번 켜준다.
setup_audio() {
  [ "${SD_AUDIO_FIX:-1}" = "1" ] || return
  command -v wpctl >/dev/null 2>&1 || return
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

  # SD_AUDIO_OUT=hdmi : 패널 내장 스피커 (기본)
  #                jack : 파이 3.5mm 잭
  local want="${SD_AUDIO_OUT:-hdmi}"
  local ids="" hdmi="" jack="" sink="" on="" off=""

  ids=$(wpctl status 2>/dev/null | sed -n '/^Audio/,/Sinks:/p' \
        | grep -oE "^ *│ *[0-9]+" | grep -oE "[0-9]+")
  for d in $ids; do
    wpctl inspect "$d" 2>/dev/null | grep -q 'vc4-hdmi-0'         && hdmi="$d"
    wpctl inspect "$d" 2>/dev/null | grep -q 'bcm2835 Headphones' && jack="$d"
  done

  if [ "$want" = "jack" ]; then on="$jack"; off="$hdmi"; else on="$hdmi"; off="$jack"; fi
  [ -n "$off" ] && wpctl set-profile "$off" 0 2>/dev/null
  [ -n "$on" ]  && wpctl set-profile "$on"  1 2>/dev/null
  sleep 3

  sink=$(wpctl status 2>/dev/null | sed -n '/Sinks:/,/Sources:/p' \
         | grep -viE "dummy" | grep -oE "[0-9]+\." | head -1 | tr -d '.')
  if [ -n "$sink" ]; then
    wpctl set-default "$sink" 2>/dev/null
    wpctl set-volume  "$sink" "${SD_VOLUME:-0.7}" 2>/dev/null
    echo "오디오: $want (sink=$sink, 볼륨 ${SD_VOLUME:-0.7})"
  else
    echo "[경고] 오디오 싱크가 없습니다. wireplumber 재시작 후 재시도합니다."
    systemctl --user restart wireplumber 2>/dev/null; sleep 4
    [ -n "$on" ] && wpctl set-profile "$on" 1 2>/dev/null; sleep 3
    sink=$(wpctl status 2>/dev/null | sed -n '/Sinks:/,/Sources:/p' \
           | grep -viE "dummy" | grep -oE "[0-9]+\." | head -1 | tr -d '.')
    if [ -n "$sink" ]; then
      wpctl set-default "$sink" 2>/dev/null
      wpctl set-volume  "$sink" "${SD_VOLUME:-0.7}" 2>/dev/null
      echo "오디오: $want (재시도 성공, sink=$sink)"
    else
      echo "[경고] 오디오 싱크 생성 실패 - 소리가 안 날 수 있습니다."
    fi
  fi
}

# ---------------------------------------------------------------- 화면 키보드
# 화면 키보드는 세션 자동시작(~/.config/autostart/story-dream-osk.desktop)으로도
# 뜨므로 앱과 무관하게 항상 존재한다. 여기서는 혹시 안 떠 있으면 한 번 띄우고,
# 앱이 꺼져도 죽이지 않는다(터미널·바탕화면 등 다른 곳에서도 계속 쓰도록).
start_keyboard() {
  [ "$OSK" = "1" ] || return
  if [ -x "$RPI_DIR/osk.sh" ]; then
    SD_OSK="$OSK" "$RPI_DIR/osk.sh" >>"$STATE_DIR/keyboard.log" 2>&1 &
  fi
}

# 종료 후 화면이 까맣게 남는 것을 막는다.
# 크로미움이 끄고 나간 화면/절전 상태를 세션 종류에 맞춰 되살린다.
wake_screen() {
  [ "$ON_EXIT" = "desktop" ] || return 0

  if [ "$IS_WAYLAND" = "1" ]; then
    # 1) 절전으로 꺼진 출력을 다시 켠다.
    command -v wlopm >/dev/null 2>&1 && wlopm --on '*' 2>/dev/null
    command -v swaymsg >/dev/null 2>&1 && swaymsg output '*' dpms on 2>/dev/null
    # 2) 컴포지터(labwc)와 출력 관리자(kanshi)에게 전체 다시 그리기를 시킨다.
    #    크로미움 --kiosk 가 사라진 자리를 월페이퍼로 다시 칠하게 하는 핵심 단계.
    pkill -HUP -x labwc 2>/dev/null || true
    pkill -HUP -x kanshi 2>/dev/null || true
    # 3) 바탕화면(월페이퍼+아이콘) 레이어를 강제로 다시 그린다.
    #    Pi OS 는 pcmanfm 을 lwrespawn 으로 감시하므로 죽이면 알아서 살아난다.
    if pgrep -x lwrespawn >/dev/null 2>&1 && pgrep -x pcmanfm >/dev/null 2>&1; then
      echo "바탕화면을 다시 그리도록 pcmanfm 을 재시작합니다(lwrespawn 이 되살림)."
      pkill -x pcmanfm 2>/dev/null || true
    fi
  fi

  if [ -n "${DISPLAY:-}" ] && command -v xset >/dev/null 2>&1; then
    xset dpms force on 2>/dev/null
    xset s reset 2>/dev/null
    # 앱 실행 중 꺼뒀던 블랭킹을 기본값으로 되돌린다.
    xset s on 2>/dev/null
    xset +dpms 2>/dev/null
  fi

  # 바탕화면을 그리는 프로세스가 아예 없고 되살릴 감시자도 없으면 직접 띄운다.
  if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v pcmanfm >/dev/null 2>&1 \
     && ! pgrep -x lwrespawn >/dev/null 2>&1; then
    sleep 1
    if ! pgrep -x pcmanfm >/dev/null 2>&1; then
      echo "바탕화면 프로세스가 없어 pcmanfm --desktop 을 다시 띄웁니다."
      (setsid pcmanfm --desktop >/dev/null 2>&1 &) || true
    fi
  fi
}

kill_group() {
  # 이름표(설명), pid 순. npm 등은 자식 프로세스를 두니 그룹째 정리한다.
  local label="$1" pid="$2"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return
  echo "${label} 종료 중 (pid=$pid)"
  kill -TERM -- "-$(ps -o pgid= "$pid" | tr -d ' ')" 2>/dev/null \
    || kill -TERM "$pid" 2>/dev/null
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL "$pid" 2>/dev/null
}

cleanup() {
  [ -n "${SPLASH_PID:-}" ] && kill "$SPLASH_PID" 2>/dev/null
  if [ -n "${QUIT_PID:-}" ] && kill -0 "$QUIT_PID" 2>/dev/null; then
    kill -TERM "$QUIT_PID" 2>/dev/null
  fi
  # 화면부터 되살린다(서버 정리는 몇 초 걸릴 수 있어 검은 화면이 길어진다).
  wake_screen
  kill_group "서버" "$SERVER_PID"
  kill_group "LED 서버" "$LED_PID"
  kill_group "엔코더" "$ENCODER_PID"
  kill_group "상호작용 서버" "$INTERACTION_PID"
  # 화면 키보드는 앱과 별개로 세션 전체에서 쓰므로 종료하지 않는다.
  [ "$(cat "${PIDFILE:-/nonexistent}" 2>/dev/null)" = "$$" ] && rm -f "$PIDFILE" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ "$ALREADY_RUNNING" = "0" ]; then
  cleanup_orphans
  start_led_server
  start_encoder
  start_interaction
  start_keyboard
  setup_audio
fi

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

# ---------------------------------------------------------------- 입력기(한글) 환경
# .desktop 으로 실행되면 세션의 IM 환경변수를 못 물려받는 경우가 있어 직접 세팅한다.
# 이게 없으면 크로미움이 ibus 를 안 거쳐서 한글 모드여도 영문만 입력된다.
if [ -z "${GTK_IM_MODULE:-}" ] && grep -qs 'ibus' "$HOME/.xinputrc" 2>/dev/null; then
  export GTK_IM_MODULE=ibus QT_IM_MODULE=ibus XMODIFIERS=@im=ibus CLUTTER_IM_MODULE=ibus
  echo "입력기 환경 설정: GTK_IM_MODULE=ibus"
fi
if [ "${GTK_IM_MODULE:-}" = "ibus" ] && command -v ibus-daemon >/dev/null 2>&1; then
  pgrep -x ibus-daemon >/dev/null 2>&1 || { ibus-daemon -d -x -r >/dev/null 2>&1 & sleep 1; }
fi

# ---------------------------------------------------------------- 카메라 권한 미리 허용
# 집중 감지에 웹캠이 필요한데 키오스크(--app)에는 권한 팝업 UI 가 없다.
# --use-fake-ui-for-media-stream 은 "지원 안 되는 플래그" 경고바를 띄우므로,
# 대신 크로미움 프로필에 앱 주소용 카메라/마이크 허용을 미리 심어둔다.
if [ "$ENABLE_INTERACTION" = "1" ] && command -v python3 >/dev/null 2>&1; then
  python3 - "$BROWSER_PROFILE" "$HOST" "$PORT" <<'PY' || true
import json, os, sys
profile, host, port = sys.argv[1], sys.argv[2], sys.argv[3]
d = os.path.join(profile, "Default")
os.makedirs(d, exist_ok=True)
pref_path = os.path.join(d, "Preferences")
try:
    prefs = json.load(open(pref_path))
except Exception:
    prefs = {}
origins = {f"http://{host}:{port},*", f"http://localhost:{port},*", f"http://127.0.0.1:{port},*"}
ex = prefs.setdefault("profile", {}).setdefault("content_settings", {}).setdefault("exceptions", {})
for key in ("media_stream_camera", "media_stream_mic"):
    table = ex.setdefault(key, {})
    for o in origins:
        table[o] = {"setting": 1}   # 1 = allow
json.dump(prefs, open(pref_path, "w"))
print("카메라 권한 프로필에 심음:", ", ".join(sorted(origins)))
PY
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
      # WebRtcPipeWireCamera: 켜져 있으면 크로미움이 웹캠을 XDG 포털로 요청하는데,
      # 키오스크엔 포털 권한 대화상자가 뜰 수 없어 거부되고 getUserMedia 가 멈춘다.
      # 끄면 /dev/video0 을 V4L2 로 직접 연다.
      --disable-features=TranslateUI,WebRtcPipeWireCamera
      --check-for-update-interval=31536000
      --autoplay-policy=no-user-gesture-required
      --disable-pinch
      --overscroll-history-navigation=0
    )
    # 진단용(기본 꺼짐): SD_DEBUG=1 이면 파이 터미널에서
    # http://127.0.0.1:9222/json 로 콘솔/네트워크 확인 가능 (127.0.0.1 전용).
    [ "${SD_DEBUG:-0}" = "1" ] && CHROME_ARGS+=(--remote-debugging-port=9222 --remote-allow-origins=http://127.0.0.1:9222)
    # Wayland 네이티브로 띄우면 화면 키보드(squeekboard)가 텍스트칸 포커스에
    # 맞춰 자동으로 올라오고 키오스크 위에 겹쳐 그려진다. (이 파이 크로미움은
    # Vulkan + Wayland 동시 사용이 안 되므로 Vulkan 을 끈다.)
    WAYLAND_MODE=0
    if [ "$WL_BROWSER" = "1" ] || { [ "$WL_BROWSER" = "auto" ] && [ "$IS_WAYLAND" = "1" ]; }; then
      WAYLAND_MODE=1
      CHROME_ARGS+=(--ozone-platform=wayland --enable-features=UseOzonePlatform --disable-features=Vulkan,TranslateUI,WebRtcPipeWireCamera)
    fi
    if [ "$KIOSK" = "1" ]; then
      # X11(openbox) 에서는 "전체화면" 상태 창이 화면 키보드(onboard 도크)까지
      # 덮어버리므로, 화면 키보드를 쓸 때는 전체화면 대신 최대화로 띄운다.
      # (키보드/마우스가 없어 사용자가 빠져나갈 방법도 없으니 키오스크와 사실상 동일)
      if [ "$IS_WAYLAND" = "0" ] && [ "$OSK" = "1" ] && command -v onboard >/dev/null 2>&1; then
        CHROME_ARGS+=(--start-maximized "--app=$URL")
        echo "[브라우저] X11 + 화면 키보드 → 전체화면 대신 최대화로 실행"
      else
        CHROME_ARGS+=(--kiosk --start-fullscreen "--app=$URL")
      fi
    else
      CHROME_ARGS+=("$URL")
    fi
    "$BROWSER" "${CHROME_ARGS[@]}" &
    BROWSER_PID=$!

    # Wayland 모드가 이 환경에서 안 뜨는 경우가 있어(즉시 종료) XWayland 로 한 번 더 시도한다.
    if [ "$WAYLAND_MODE" = "1" ]; then
      sleep 3
      if ! kill -0 "$BROWSER_PID" 2>/dev/null; then
        echo "[브라우저] Wayland 모드 기동 실패 → XWayland 로 재시도합니다."
        CHROME_ARGS=("${CHROME_ARGS[@]/--ozone-platform=wayland/--ozone-platform=x11}")
        "$BROWSER" "${CHROME_ARGS[@]}" &
        BROWSER_PID=$!
      fi
    fi
    ;;
esac
: "${BROWSER_PID:=$!}"
echo "브라우저 pid=$BROWSER_PID"

# 다른 런처가 이미 서버를 소유 중이면(중복 실행), 브라우저만 다시 열어주고
# 여기서 끝낸다. wait/cleanup 으로 넘어가면 남의 서버를 정리해 버린다.
if [ "$ALREADY_RUNNING" = "1" ]; then
  trap - EXIT INT TERM
  echo "브라우저만 다시 열고 종료합니다."
  exit 0
fi

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
