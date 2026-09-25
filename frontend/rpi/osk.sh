#!/usr/bin/env bash
# 화면 키보드(On-Screen Keyboard) 를 세션에 맞게 띄운다.
#   - Wayland(labwc) 세션 : squeekboard (layer-shell, 전체화면 위에 겹쳐짐)
#   - X11(LXDE/openbox)   : onboard    (화면 밑 가로 전체 도킹)
#
# story-dream 앱뿐 아니라 터미널·바탕화면 등 어디서나 쓰도록 세션 자동시작
# (~/.config/autostart/story-dream-osk.desktop) 에서 실행된다. story-dream 런처도
# 이 스크립트를 호출한다. 여러 번 불려도 안전하다(이미 떠 있으면 그냥 끝냄).
#
# 환경변수:
#   SD_OSK=0            : 아무것도 안 띄움
#   SD_OSK_AUTOHIDE=1   : (onboard) 평소 숨기고 텍스트칸 포커스 시에만 표시
set -u

_log="${XDG_STATE_HOME:-$HOME/.local/state}/story-dream/keyboard.log"
mkdir -p "$(dirname "$_log")" 2>/dev/null || true
exec >>"$_log" 2>&1
echo "===== $(date '+%F %T') osk.sh 시작 (DISPLAY=${DISPLAY:-} WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-}) ====="

# 런처와 같은 설정 파일을 읽는다 (자동시작으로 불릴 때도 SD_OSK 등이 먹도록).
_conf="${XDG_CONFIG_HOME:-$HOME/.config}/story-dream/launcher.env"
# shellcheck disable=SC1090
[ -f "$_conf" ] && . "$_conf"

[ "${SD_OSK:-1}" = "1" ] || { echo "SD_OSK=0 → 건너뜀"; exit 0; }

# ---- 세션 감지 -------------------------------------------------------------
IS_WAYLAND=0
_wl_sock="$(ls "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"/wayland-[0-9]* 2>/dev/null | head -1)"
if [ -n "${WAYLAND_DISPLAY:-}" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ] \
   || [ -n "$_wl_sock" ] || pgrep -x "labwc|wayfire|sway|weston" >/dev/null 2>&1; then
  IS_WAYLAND=1
  : "${XDG_RUNTIME_DIR:=/run/user/$(id -u)}"; export XDG_RUNTIME_DIR
  [ -n "${WAYLAND_DISPLAY:-}" ] || WAYLAND_DISPLAY="$(basename "${_wl_sock:-wayland-0}")"
  export WAYLAND_DISPLAY
else
  : "${DISPLAY:=:0}"; export DISPLAY
  # 세션 밖(런처 등)에서 불릴 때 X 인증 파일을 찾아준다.
  if [ -z "${XAUTHORITY:-}" ]; then
    for x in "$HOME/.Xauthority" "/var/run/lightdm/root/${DISPLAY}" \
             "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/xauth_"*; do
      [ -s "$x" ] && { export XAUTHORITY="$x"; break; }
    done
  fi
fi

# ---- Wayland : squeekboard ----------------------------------------------
if [ "$IS_WAYLAND" = "1" ]; then
  command -v squeekboard >/dev/null 2>&1 || { echo "osk: squeekboard 없음"; exit 0; }
  pkill -x onboard 2>/dev/null || true
  pgrep -x squeekboard >/dev/null 2>&1 && exit 0
  exec squeekboard
fi

# ---- X11 : onboard ------------------------------------------------------
command -v onboard >/dev/null 2>&1 || { echo "osk: onboard 없음 (sudo apt install onboard)"; exit 0; }

# onboard 키 입력을 XTest 로 보내야 ibus(한글 조합)가 가로챈다. (auto/AT-SPI 는 IME 우회)
gsettings set org.onboard.keyboard key-synth 'XTest' 2>/dev/null || true

# 한글 자판:
#   SD_OSK_KO=1 (기본) : ibus 한/영 모드에 맞춰 자판을 통째로 교체 (한글 모드=ㅂㅈㄷ 자판)
#   SD_OSK_KO=0        : 영문 자판 고정
_here="$(dirname "$(readlink -f "$0")")"
_kolay="$HOME/.local/share/onboard/layouts/Korean.onboard"
_ko="${SD_OSK_KO:-1}"

if [ "$_ko" != "0" ] && [ ! -f "$_kolay" ] && [ -d "$_here/onboard" ]; then
  mkdir -p "$(dirname "$_kolay")"
  cp -f "$_here/onboard"/Korean.onboard "$_here/onboard"/Compact-*.svg \
        "$(dirname "$_kolay")"/ 2>/dev/null || true
fi

pkill -f "osk-langwatch.sh" 2>/dev/null || true
if [ "$_ko" = "0" ] || [ ! -f "$_kolay" ]; then
  gsettings set org.onboard layout 'Compact' 2>/dev/null || true
else
  # 현재 모드에 맞는 자판으로 시작 + 감시자 실행
  case "$(ibus engine 2>/dev/null)" in
    *hangul*) gsettings set org.onboard layout "$_kolay" 2>/dev/null || true ;;
    *)        gsettings set org.onboard layout 'Compact' 2>/dev/null || true ;;
  esac
  if [ -x "$_here/osk-langwatch.sh" ]; then
    setsid "$_here/osk-langwatch.sh" >/dev/null 2>&1 &
    echo "한/영 자판 자동전환 감시자 시작"
  fi
fi

# 화면 밑에 가로로 도킹하되, 기본은 "필요할 때만" 뜬다(텍스트칸 포커스 시 자동 표시,
# 평소엔 숨김). SD_OSK_ALWAYS=1 이면 항상 떠 있는다.
gsettings set org.onboard.window docking-enabled true            2>/dev/null || true
gsettings set org.onboard.window docking-edge 'bottom'           2>/dev/null || true
gsettings set org.onboard.window.landscape dock-expand true      2>/dev/null || true
gsettings set org.onboard.window.portrait  dock-expand true      2>/dev/null || true
gsettings set org.onboard.window force-to-top true               2>/dev/null || true
gsettings set org.onboard.auto-show tablet-mode-detection-enabled false 2>/dev/null || true

if [ "${SD_OSK_ALWAYS:-0}" = "1" ]; then
  gsettings set org.onboard.auto-show enabled false              2>/dev/null || true
  gsettings set org.onboard start-minimized false                2>/dev/null || true
  gsettings set org.onboard.window docking-shrink-workarea true  2>/dev/null || true
else
  # 필요할 때만: 자동 표시 켜고, 시작 시엔 숨김. 앱 창을 리사이즈하지 않고 겹쳐 뜬다.
  gsettings set org.onboard.auto-show enabled true               2>/dev/null || true
  gsettings set org.onboard start-minimized true                 2>/dev/null || true
  gsettings set org.onboard.window docking-shrink-workarea false 2>/dev/null || true
fi

if pgrep -x onboard >/dev/null 2>&1; then
  echo "onboard 이미 떠 있음 (설정만 갱신, 재시작 필요시 pkill onboard)"
  exit 0
fi
[ "${SD_OSK_ALWAYS:-0}" = "1" ] && echo "onboard 시작 (항상 표시)" || echo "onboard 시작 (텍스트칸 누를 때만 표시)"
exec onboard
