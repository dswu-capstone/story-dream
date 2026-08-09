# 라즈베리파이 런처

바탕화면 아이콘을 더블클릭하면 `npm run dev` 가 자동으로 실행되고,
서버가 준비되는 즉시 브라우저가 전체화면으로 열립니다.
브라우저를 닫으면 서버도 같이 종료됩니다.

## 설치 (라즈베리파이에서 1회)

```bash
cd ~/story-dream/frontend/rpi
chmod +x install.sh story-dream-launch.sh
./install.sh
```

부팅하자마자 자동으로 켜지게 하려면:

```bash
./install.sh --autostart
```

제거:

```bash
./install.sh --uninstall
```

## 사전 준비물

- Node.js 24.x / npm 11.x
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
- 브라우저: `sudo apt install -y chromium-browser`
- (선택) 안내창용 `zenity`, 아이콘 변환용 `librsvg2-bin`
  ```bash
  sudo apt install -y zenity librsvg2-bin
  ```

`node_modules` 가 없으면 첫 실행 때 런처가 알아서 `npm ci` 를 돌립니다(몇 분 소요).

## 설정

`~/.config/story-dream/launcher.env` 를 수정하면 다음 실행부터 적용됩니다.

| 항목 | 기본값 | 설명 |
|---|---|---|
| `SD_MODE` | `dev` | `dev` = `npm run dev`, `preview` = 빌드 후 정적 서빙 |
| `SD_PORT` | `5173` | 개발 서버 포트 |
| `SD_KIOSK` | `1` | `1` = 전체화면(주소창 없음), `0` = 일반 창 |
| `SD_ROUTE` | `/` | 처음 열 페이지 |
| `SD_DISABLE_BLANK` | `1` | 실행 중 화면 절전 방지 |
| `SD_QUIT_PORT` | `5174` | 화면 안 X 버튼용 제어 서버 포트 |
| `SD_EXIT_CONFIRM` | `1` | `1` = X 누르면 확인창, `0` = 바로 종료 |
| `SD_ON_EXIT` | `desktop` | 종료 후 동작: `desktop` / `poweroff` / `reboot` |

### dev vs preview

라즈베리파이에서 `npm run dev`(vite dev)는 기동도 느리고 페이지 전환마다
on-demand 트랜스파일이 걸려 눈에 띄게 버벅입니다. 코드를 계속 고치는 게
아니라 "완성된 앱처럼 쓰는" 용도라면 `SD_MODE=preview` 를 권합니다.
빌드 결과를 정적으로 서빙해서 실행 속도가 훨씬 낫습니다.

## 화면 안 X 버튼으로 종료하기

터치 화면에는 키보드가 없어 `Alt+F4` 를 누를 수 없으므로, 키오스크로 뜨면
오른쪽 위에 종료용 X 버튼이 나타납니다.

동작 방식: 웹페이지는 자기 브라우저 창을 죽일 수 없기 때문에, 런처가
`quit-server.mjs`(127.0.0.1 전용, 기본 5174 포트)를 같이 띄워둡니다.
X 를 누르면 여기에 요청이 가고 → 브라우저가 종료되고 → 런처가 vite 까지 정리합니다.

- 기본은 실수로 꺼지는 걸 막으려고 "종료할까요?" 확인창이 뜹니다.
  바로 꺼지게 하려면 `SD_EXIT_CONFIRM=0`.
- `npm run dev` 만 따로 켰을 때는 이 버튼이 보이지 않습니다
  (URL 에 `?kiosk=1` 이 붙은 경우에만 렌더링).

## 터치로 아이콘이 잘 안 눌릴 때 / "Execute" 확인창이 뜰 때

`install.sh` 가 `~/.config/libfm/libfm.conf` 에 아래 두 개를 넣습니다.

| 키 | 효과 |
|---|---|
| `quick_exec=1` | `.desktop` 을 눌렀을 때 뜨는 **Execute / Open 선택창 제거** → 바로 실행 |
| `single_click=1` | **한 번만 탭해도 실행** → 터치 화면에서 더블탭이 잘 안 먹는 문제 해결 |

터치스크린은 두 번 탭할 때 좌표가 미세하게 어긋나면 더블클릭으로 인식되지 않습니다.
싱글클릭으로 바꾸는 게 근본 해결책입니다.

적용하려면 **로그아웃/재부팅**하거나 `pcmanfm --desktop` 을 다시 띄워야 합니다.

## 종료 후 화면이 검게 남을 때

런처는 종료할 때 화면을 되살리려고 다음을 시도합니다.

- X11: `xset dpms force on`, `xset s reset` (실행 중 껐던 절전도 원복)
- Wayland: `wlopm --on '*'`, `swaymsg output '*' dpms on`
- 바탕화면 프로세스(`pcmanfm`)가 죽어 있으면 다시 띄움

그래도 검은 화면이면 원인이 환경마다 다르므로 아래를 실행해서 결과를 확인하세요.

```bash
./diagnose.sh
```

특히 "바탕화면 / 윈도우매니저 프로세스"가 **비어 있으면**, 바탕화면 없이 브라우저만
띄우는 세션이라 앱이 꺼지는 순간 그릴 게 없어서 검게 보이는 것입니다.
이 경우 `SD_ON_EXIT=poweroff` 로 두고 X 버튼을 "전원 끄기"로 쓰는 편이 자연스럽습니다.

## 알아둘 것

- 전체화면 탈출: 화면 오른쪽 위 X 버튼 (키보드가 있으면 `Alt+F4`)
- 로그: `~/.local/state/story-dream/launcher.log`, `server.log`
- 아이콘을 두 번 눌러도 서버는 하나만 뜹니다(중복 실행 방지). 이미 떠 있으면
  브라우저만 다시 열립니다.
- 이 앱은 `/api` 요청을 `http://localhost:8080` (백엔드)으로 프록시합니다
  (`vite.config.ts`). 백엔드가 라즈베리파이에 없다면 API 호출은 실패하므로,
  백엔드도 같이 띄우거나 프록시 대상을 서버 주소로 바꿔야 합니다.
