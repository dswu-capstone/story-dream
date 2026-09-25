#!/usr/bin/env bash
# ibus 입력 모드(한글/영문)에 맞춰 onboard 자판 라벨을 통째로 바꾼다.
#   한글 모드 -> Korean.onboard (ㅂㅈㄷ… 자판)
#   영문 모드 -> Compact        (영문 자판)
# onboard 는 org.onboard 'layout' gsettings 변경을 감지해 즉시 다시 그린다.
# 다시 그릴 때 잠깐 숨는 경우가 있어 D-Bus 로 다시 표시시킨다.
set -u

KOLAY="$HOME/.local/share/onboard/layouts/Korean.onboard"
ENG_LAYOUT="Compact"
[ -f "$KOLAY" ] || exit 0
command -v ibus >/dev/null 2>&1 || exit 0

LOCK="${XDG_RUNTIME_DIR:-/tmp}/sd-osk-langwatch.lock"
exec 9>"$LOCK" || exit 0
flock -n 9 || exit 0

show_onboard() {
  dbus-send --session --type=method_call --dest=org.onboard.Onboard \
    /org/onboard/Onboard/Keyboard org.onboard.Onboard.Keyboard.Show 2>/dev/null || true
}

last=""
while :; do
  cur="$(ibus engine 2>/dev/null)" || { sleep 1; continue; }
  if [ "$cur" != "$last" ]; then
    last="$cur"
    case "$cur" in
      *hangul*) gsettings set org.onboard layout "$KOLAY" 2>/dev/null || true ;;
      *)        gsettings set org.onboard layout "$ENG_LAYOUT" 2>/dev/null || true ;;
    esac
    sleep 0.25
    show_onboard
  fi
  sleep 0.4
done
