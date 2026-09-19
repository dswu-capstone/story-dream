# Stage 5 보완: browser 감지 → Backend FocusLog

## 실행 경로와 기존 기능 보존

`StoryReadingPage` → `BrowserFocusMonitor.start()` → `getUserMedia()` → 350ms 간격 프레임
→ 기존 Node `/api/detect-pose` → `pose_worker.py`의 기존 ONNX 모델
→ `BrowserFocusMonitor.handleState()`의 기존 8프레임 smoothing.

그 이후 두 갈래로 처리한다.

- 기존 상호작용: side/back·absent 타이머, 15초 임계값 → `/api/focus` → FocusMonitor SSE
  → 독서 페이지의 캐릭터 화면 이동. 이 코드와 이벤트 의미는 유지했다.
- 추가 기록: 동일한 smoothing 결과 → `browserFocusRecording.ts` → `focusEvents.ts`
  → 기존 `/api` 프록시 → Spring focus-events. 프레임은 Spring으로 보내지 않는다.

mode의 기준은 기존 Node `/api/session`의 `focus.source`이다. `VITE_FOCUS_SOURCE`는
이 값과의 일치 검증에만 사용한다. browser 기록은 감지 응답의 `source=browser`도 확인한다.
Node `/session`에 기존 `FOCUS_TIME_ZONE`의 `focus.timezone`, `/detect-pose`에 `source`만
추가했다. 기존 필드와 분류 결과는 변경하지 않았다.

camera에서는 Python FocusEpisode만 기록하며 프론트 browser 기록기는 활성화되지 않는다.
browser에서는 브라우저 기록기만 기록하며 Node의 기존 cameraFocusEnabled=false 조건으로
camera_focus.py/FocusRecording이 비활성이다. pose_worker.py는 상태만 반환한다.
독서 도중 mode 변경은 거부한다. 기존 모드로 복구해 독서를 정상 종료한 뒤 변경한다.

## 독서 세션과 구간

`ReadingStartResponse.readingHistoryId` → `saveReadingSession`
→ 기존 `FocusSessionLifecycle` → `syncFocusSession` → browser 기록기.

- 읽기 화면에서만 새 구간을 확정하며 세션 ID가 없으면 전송하지 않는다.
- SIDE/BACK/ABSENT는 하나의 away 상태이다. `performance.now()` 경과 10초에 UUID를 한 번 만든다.
- 계속 away이면 새 이벤트를 만들지 않는다. FRONT 1초 관측 후 같은 ID로 복귀를 전송한다.
  복귀 시각은 1초 대기가 시작된 첫 FRONT 시각이다.
- 확정 전 화면 이동/감지 실패는 미확정 구간을 초기화한다. 응답 대기 중 화면이나 세션이
  바뀌면 이전 샘플을 기록에 사용하지 않는다. 기존 캐릭터 이벤트 처리는 그대로이다.
- 확정된 구간 ID는 화면 이동에도 유지한다. 퀴즈/next-part는 기존 flush 호출을 통해
  확정 이벤트가 저장된 뒤 진행하며, 전송 실패 시 진행을 거부한다.
- 독서 종료는 기존 end API 호출 전에 대기 이벤트와 열린 구간의 종료 요청을 처리한다.
  카메라가 없는 화면에서 종료하면 마지막으로 관측한 시점까지 기록한다.
  정상 종료 후에는 이전 ID의 heartbeat와 늦게 도착한 프레임으로 재시작하지 않는다.

## Spring 계약과 시간

`POST /api/reading-histories/10/focus-events`

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "focus_lost",
  "occurredAt": "2026-09-20T10:00:10",
  "durationSeconds": 10
}
```

30초에 정상 복귀한 경우 같은 ID로:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "focus_recovered",
  "occurredAt": "2026-09-20T10:00:30",
  "durationSeconds": 30
}
```

partType/level은 보내지 않는다. Backend가 현재 ReadingLog를 사용한다.
FOCUS_TIME_ZONE은 Backend JVM의 실제 시간대와 같아야 한다. 설정이 없거나 잘못되면
기록을 시작하지 않으며 퀴즈/next-part의 기록 검증도 실패한다. PC의 OS 시간대를 추측하지 않는다.
시작 시간을 초 단위로 고정한 뒤 monotonic 경과 시간을 더하여 Spring의
`occurredAt - startedAt == durationSeconds` 조건을 지킨다. PC 시계 동기화가 필요하다.

전송은 FIFO, timeout 3초, 최대 4회, backoff 1/2/4초이다. 같은 요청 body/ID로 재시도하며
확정 응답 SAVED/ALREADY_PROCESSED를 받은 다음 복귀를 전송한다. 408/429 외의 4xx는
즉시 보류한다. 실패한 이벤트는 메모리에 유지하고 다음 flush에서 같은 ID로 재시도한다.
큐는 최대 128개이며 초과/전송 실패는 조용히 버리지 않고 진행 전 검증 오류로 처리한다.

## Windows PC 수동 검증

Spring Backend와 Stage 4 DB 적용을 먼저 확인한다. Node가 이미 실행 중이면 Ctrl+C 후 재시작한다.
프로젝트 루트에서 PowerShell로 실행한다. 아래 시간대는 **Backend JVM이 Asia/Seoul일 때의 예시**다.

```powershell
$env:PYTHON_BIN = (Resolve-Path .\AI\realtimeinteraction\venv\Scripts\python.exe).Path
$env:FOCUS_SOURCE = "browser"
$env:FOCUS_TIME_ZONE = "Asia/Seoul"
node --env-file=AI/realtimeinteraction/.env AI/realtimeinteraction/app/server.js
```

`PYTHON_BIN`은 YOLO 패키지가 설치된 가상환경 실행 파일, `$env:`는 현재 터미널의 환경변수다.
browser 기록은 Spring에 직접 `/api`로 보내므로 Node BACKEND_BASE_URL을 사용하지 않는다.
camera 모드에서는 기존처럼 BACKEND_BASE_URL과 FOCUS_TIME_ZONE을 사용한다.

다른 PowerShell에서:

```powershell
cd frontend
$env:VITE_FOCUS_SOURCE = "browser"
npm.cmd run dev
```

기존 프론트 `/api` 프록시의 `VITE_BACKEND_PROXY_TARGET`이 실제 Backend를 가리켜야 한다.
Vite가 출력한 localhost 주소로 접속해 카메라 권한을 허용한다. 브라우저의 getUserMedia와
crypto.randomUUID는 localhost 또는 HTTPS 환경에서 사용한다.

1. F12 → Network → Preserve log → `focus-events` 필터.
2. 로그인 후 **새 독서 세션**을 시작한다. Response의 readingHistoryId와 URL을 비교한다.
3. 읽기 화면에서 정면을 보다가 약 5초 이탈 후 정면: focus-events 요청 없음.
4. smoothing 이후 이탈이 10초 누적되면 focus_lost 한 건, 응답 SAVED.
5. 기존 캐릭터 반응은 기존 15초 기준이다. 캐릭터 화면으로 이동하면 기존처럼 카메라가 멈춘다.
6. 읽기 화면으로 돌아와 정면 유지: FRONT smoothing과 1초 안정화 후 같은 ID로 RECOVERED.
7. 다시 10초 이탈: 다른 ID. 같은 세션에서 세 번 하려면 안정적인 복귀를 사이에 넣는다.
8. Console의 `[focus-browser] ... event=... status=...`와 Network body/응답을 확인한다.
9. 마지막 퀴즈 `/submit`의 `recommendedLevel`을 확인한다. 현재 level 2, 정답 4 이상,
   확정 이탈 1 이하라면 3이다. 수락/거절 후 next-part의 selectedLevel과 응답 level을 확인한다.
10. 독서 종료 후 새 focus-events 요청이 없는지 확인한다.

## 자동화 테스트

```powershell
cd frontend
node --test tests/focus-session.test.cjs
npm.cmd run lint
npm.cmd run build
```

루트에서 기존 camera 회귀 테스트:

```powershell
node --test AI/realtimeinteraction/tests/focus-recording.test.js
python -B AI/realtimeinteraction/tests/test_focus_episode.py
```

## 남은 제한 / 실제 Pi 검증

- 기존 브라우저 카메라는 읽기 화면에서만 동작한다. 상호작용/퀴즈 화면의 정확한 복귀 시각은
  알 수 없다. 열린 ID는 유지하되, 읽기 화면으로 돌아와 관측한 안정적 FRONT 시점에 종료한다.
  이때 관측하지 못한 공백이 duration에 포함될 수 있다. 30초 연속 관측과 30초 복귀는 자동화로
  검증했고 기존 15초 캐릭터 화면 이동을 끄는 방식으로 실기기 검증했다고 주장하지 않는다.
- 새로고침/탭 강제 종료는 메모리 ID/큐가 사라진다. 여러 탭/여러 장치가 같은 독서를 동시에
  관측하는 경우는 조정하지 않는다. 검증은 독서 탭 하나로 진행한다.
- PC 절전·백그라운드 탭의 프레임 지연, 실제 카메라/FPS, HTTP 장애 복구는 수동 확인 대상이다.
- 같은 mode 안의 자동 재시도와 mode 간 생성 주체 분리는 구현했다. 임의 클라이언트의
  직접 호출/새 ID 중복 생성까지 서버가 막는 것은 아니다. 기존 permitAll 인증은 변경하지 않았다.
- 파트 전환 전 확정 큐 flush를 재사용한다. 다른 클라이언트의 직접 next-part나 강제 종료까지
  원자적으로 처리하지 않는다. 경계를 가로지르는 하나의 구간은 최초 FocusLog 귀속을 유지한다.
- Pi에서 camera 모드의 Python 기록, 복귀, 기존 캐릭터 상호작용을 다시 확인한다.
  모델, camera_focus.py, FocusMonitor/FocusRecording/FocusEventSender는 수정하지 않았다.
- DB 변경은 실행하지 않았다. 기존 [Stage 4 DB 작업](../../backend/docs/focus-events-stage4.md)의
  event_id, 복합 UNIQUE, 필요한 state 제약이 실제 DB에 적용돼 있어야 한다.
