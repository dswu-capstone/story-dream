#!/usr/bin/env bash
# 라즈베리파이에 Story Dream 아이콘(런처)을 설치한다.
#
#   ./install.sh              앱 메뉴 + 바탕화면 아이콘 설치
#   ./install.sh --autostart  부팅하면 자동 실행까지 등록
#   ./install.sh --uninstall  전부 제거
set -euo pipefail

RPI_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$RPI_DIR/.." && pwd)"
LAUNCHER="$RPI_DIR/story-dream-launch.sh"

APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/story-dream"
DESKTOP_FILE="$APPS_DIR/story-dream.desktop"

# 바탕화면 경로 (한글 로케일이면 '바탕화면' 일 수 있다)
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
if [ -z "$DESKTOP_DIR" ] || [ ! -d "$DESKTOP_DIR" ]; then
  DESKTOP_DIR="$HOME/Desktop"
fi

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$DESKTOP_FILE" "$DESKTOP_DIR/story-dream.desktop" \
        "$AUTOSTART_DIR/story-dream.desktop" \
        "$ICON_DIR/story-dream.png" "$ICON_DIR/story-dream.svg"
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
  echo "제거했습니다. (설정 $CONF_DIR 은 남겨둡니다)"
  exit 0
fi

mkdir -p "$APPS_DIR" "$ICON_DIR" "$CONF_DIR" "$DESKTOP_DIR"
chmod +x "$LAUNCHER"

# ---------------------------------------------------------------- 아이콘 준비
SRC_ICON="$APP_DIR/src/assets/logo.svg"
ICON_PATH=""
if [ -f "$SRC_ICON" ]; then
  # .desktop 아이콘은 png 가 가장 호환이 좋다. 변환기가 있으면 png 로 만든다.
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 256 -h 256 "$SRC_ICON" -o "$ICON_DIR/story-dream.png"
    ICON_PATH="$ICON_DIR/story-dream.png"
  elif command -v convert >/dev/null 2>&1; then
    convert -background none -resize 256x256 "$SRC_ICON" "$ICON_DIR/story-dream.png"
    ICON_PATH="$ICON_DIR/story-dream.png"
  elif command -v inkscape >/dev/null 2>&1; then
    inkscape "$SRC_ICON" --export-type=png --export-width=256 \
      --export-filename="$ICON_DIR/story-dream.png" >/dev/null 2>&1
    ICON_PATH="$ICON_DIR/story-dream.png"
  else
    cp "$SRC_ICON" "$ICON_DIR/story-dream.svg"
    ICON_PATH="$ICON_DIR/story-dream.svg"
  fi
else
  ICON_PATH="applications-education"   # 로고가 없으면 시스템 기본 아이콘
fi

# ---------------------------------------------------------------- .desktop 생성
sed -e "s|@LAUNCHER@|$LAUNCHER|g" \
    -e "s|@ICON@|$ICON_PATH|g" \
    "$RPI_DIR/story-dream.desktop.in" > "$DESKTOP_FILE"
chmod +x "$DESKTOP_FILE"
update-desktop-database "$APPS_DIR" 2>/dev/null || true

# 바탕화면 복사본 (더블클릭으로 바로 실행)
cp "$DESKTOP_FILE" "$DESKTOP_DIR/story-dream.desktop"
chmod +x "$DESKTOP_DIR/story-dream.desktop"
# GNOME/일부 파일매니저는 '신뢰함' 표시가 있어야 실행된다.
gio set "$DESKTOP_DIR/story-dream.desktop" metadata::trusted true 2>/dev/null || true

# ---------------------------------------------------------------- 기본 설정 파일
if [ ! -f "$CONF_DIR/launcher.env" ]; then
  cat > "$CONF_DIR/launcher.env" <<'EOF'
# Story Dream 런처 설정 (수정 후 저장하면 다음 실행부터 적용됩니다)

# dev     : npm run dev (코드 수정이 바로 반영, 라즈베리파이에선 느림)
# preview : npm run build 후 정적 서빙 (기동은 느리지만 실행은 훨씬 빠름)
SD_MODE=dev

SD_HOST=127.0.0.1
SD_PORT=5173

# 1 = 전체화면(주소창 없음), 0 = 일반 브라우저 창
SD_KIOSK=1

# 처음 열 페이지 경로
SD_ROUTE=/

# 1 = 실행 중 화면 꺼짐/절전 방지
SD_DISABLE_BLANK=1

# 화면 안 X 버튼
SD_QUIT_PORT=5174
# 1 = X 를 누르면 "종료할까요?" 확인창, 0 = 바로 종료
SD_EXIT_CONFIRM=1

# 앱 종료 후 동작: desktop(바탕화면 복귀) | poweroff | reboot
SD_ON_EXIT=desktop
EOF
  echo "설정 파일 생성: $CONF_DIR/launcher.env"
else
  # 이미 설정 파일이 있으면 새로 생긴 항목만 덧붙인다(기존 값은 건드리지 않음).
  for kv in "SD_QUIT_PORT=5174" "SD_EXIT_CONFIRM=1" "SD_ON_EXIT=desktop"; do
    key="${kv%%=*}"
    grep -q "^${key}=" "$CONF_DIR/launcher.env" \
      || printf '%s\n' "$kv" >> "$CONF_DIR/launcher.env"
  done
  echo "설정 파일 갱신: $CONF_DIR/launcher.env"
fi

# ---------------------------------------------------------------- 파일매니저 설정
# 두 가지를 한 번에 잡는다.
#   quick_exec=1   : .desktop 을 누를 때 뜨는 "Execute / Open" 확인창 제거 → 바로 실행
#   single_click=1 : 한 번 탭하면 실행 → 터치 화면에서 더블탭이 잘 안 먹는 문제 해결
python3 - "$HOME" <<'PY'
import os, sys, configparser

home = sys.argv[1]
conf = os.path.join(home, ".config", "libfm", "libfm.conf")
os.makedirs(os.path.dirname(conf), exist_ok=True)

cp = configparser.ConfigParser()
cp.optionxform = str          # 키 대소문자 보존
if os.path.exists(conf):
    cp.read(conf, encoding="utf-8")
if not cp.has_section("config"):
    cp.add_section("config")

cp.set("config", "quick_exec", "1")
cp.set("config", "single_click", "1")

with open(conf, "w", encoding="utf-8") as f:
    cp.write(f, space_around_delimiters=False)
print(f"파일매니저 설정 반영: {conf} (quick_exec=1, single_click=1)")
PY

# 바탕화면 아이콘도 싱글클릭으로 열리게 (pcmanfm 데스크톱 설정)
for d in "$HOME"/.config/pcmanfm/*/; do
  [ -d "$d" ] || continue
  item="$d/desktop-items-0.conf"
  [ -f "$item" ] || continue
  grep -q "^single_click=" "$item" \
    && sed -i "s/^single_click=.*/single_click=1/" "$item" \
    || printf '\nsingle_click=1\n' >> "$item"
done

echo "※ 설정을 적용하려면 로그아웃/재부팅하거나 'pcmanfm --desktop' 을 다시 띄우세요."

# ---------------------------------------------------------------- 자동 실행(선택)
if [ "${1:-}" = "--autostart" ]; then
  mkdir -p "$AUTOSTART_DIR"
  cp "$DESKTOP_FILE" "$AUTOSTART_DIR/story-dream.desktop"
  echo "부팅 시 자동 실행을 등록했습니다."
fi

cat <<EOF

설치 완료.
  런처 스크립트 : $LAUNCHER
  앱 메뉴       : $DESKTOP_FILE
  바탕화면      : $DESKTOP_DIR/story-dream.desktop
  설정          : $CONF_DIR/launcher.env
  로그          : ${XDG_STATE_HOME:-\$HOME/.local/state}/story-dream/

바탕화면의 'Story Dream' 아이콘을 더블클릭하면 실행됩니다.
전체화면에서 빠져나오려면 Alt+F4 (또는 Ctrl+W) 를 누르세요.
EOF
