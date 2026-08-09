#!/usr/bin/env bash
# 검은 화면 / 터치 문제를 진단한다. 라즈베리파이에서 실행한 뒤 출력을 공유하면 된다.
echo "=== 세션 종류 ==="
echo "XDG_SESSION_TYPE = ${XDG_SESSION_TYPE:-(없음)}"
echo "DISPLAY          = ${DISPLAY:-(없음)}"
echo "WAYLAND_DISPLAY  = ${WAYLAND_DISPLAY:-(없음)}"
echo "XDG_CURRENT_DESKTOP = ${XDG_CURRENT_DESKTOP:-(없음)}"

echo
echo "=== OS ==="
grep PRETTY_NAME /etc/os-release 2>/dev/null

echo
echo "=== 바탕화면 / 윈도우매니저 프로세스 ==="
pgrep -al 'pcmanfm|wayfire|labwc|openbox|mutter|lxsession|wf-panel|xfdesktop' || echo "(없음 — 종료 후 검은 화면의 주요 원인)"

echo
echo "=== 화면 절전 상태 ==="
if [ -n "${DISPLAY:-}" ] && command -v xset >/dev/null 2>&1; then
  xset q | sed -n '/Screen Saver/,/DPMS/p'
else
  echo "(X11 이 아니거나 xset 없음)"
fi

echo
echo "=== 사용 가능한 화면 제어 도구 ==="
for c in xset wlopm swaymsg pcmanfm zenity node npm chromium-browser chromium; do
  printf '%-18s %s\n' "$c" "$(command -v $c || echo '없음')"
done

echo
echo "=== 파일매니저 설정 ==="
cat "${XDG_CONFIG_HOME:-$HOME/.config}/libfm/libfm.conf" 2>/dev/null || echo "(libfm.conf 없음)"

echo
echo "=== 최근 런처 로그 (마지막 30줄) ==="
tail -30 "${XDG_STATE_HOME:-$HOME/.local/state}/story-dream/launcher.log" 2>/dev/null || echo "(로그 없음)"
