# 5단계: Pi 집중도 감지 → Spring FocusLog 기록

## 기존 기능 보존과 실제 실행 경로

저장소 코드로 확인한 경로이며 실제 Pi에서 실행했다는 의미는 아니다.

1. `frontend/rpi/install.sh --autostart`로 등록한 데스크톱 실행 항목은
   `frontend/rpi/story-dream-launch.sh`를 실행한다.
2. 이 런처는 Vite와 Chromium을 실행한다. Node 상호작용 서버는 자동 실행하지 않는다.
3. 기존 `AI/realtimeinteraction/start.sh`가 `app/server.js`를 실행한다.
   `NO_BROWSER=1`이면 예제 HTML 화면을 열지 않고 기존 React와 함께 사용할 수 있다.
4. 기존 설정 `FOCUS_SOURCE=camera`와 `CAMERA_FOCUS!=0`이면 FocusMonitor가
   `camera_focus.py`를 실행한다. Python의 OpenCV/YOLO가 Pi 웹캠을 분석한다.
5. 기존 감지 결과는 `/api/focus` → FocusMonitor.handleSignal → SSE `/api/events`
   → React의 focusInteraction.ts → 캐릭터 상호작용으로 전달된다. 이 흐름은 그대로다.
6. 새 기록 메시지만 별도의 stdout `FOCUS_EVENT` 채널 → FocusRecording
   → FocusEventSender → Spring focus-events로 전달된다. 영상은 Spring으로 보내지 않는다.

기존 15초 상호작용 임계값, side/back·absent 별도 타이머, 복귀 이벤트,
handleSignal의 이벤트 ID와 timestamp 처리, SSE, 모델 분류/스무딩을 변경하지 않았다.
따라서 **Backend 기록은 10초에 생성되지만 기존 캐릭터 반응은 기존 기준대로 동작한다.**

브라우저 모드도 삭제하거나 강제로 끄지 않았다. 기존 `/session`의 focus.source에 따라
React의 BrowserFocusMonitor가 선택되는 기존 로직을 유지한다.
Backend 기록의 유일한 생성자는 Python FocusEpisode이다. 브라우저와 기존 HTTP
상호작용 신호는 FocusEventSender에 넣지 않으므로 Backend 기록이 중복 생성되지 않는다.

## 새 기록 전용 연결

- `ReadingStartResponse.readingHistoryId` → 기존 readingSession 저장
  → 변경 알림 → FocusSessionLifecycle → 로컬 `POST /api/focus/session`
  → FocusRecording → Python stdin → 기록 전용 FocusEpisode.
- 로컬 제어 요청: `{action:"sync",readingHistoryId:10,detect:true}`.
  `flush`는 확정 메시지 전달 완료를 확인하고, `stop`은 기록만 종료한다.
- React가 기존 상호작용/퀴즈/결과/난이도 선택 화면으로 이동하면 새 이탈 확정만 중지한다.
  이미 확정된 구간의 복귀는 계속 관찰한다. 카메라와 기존 상호작용은 계속 동작한다.
- 읽기 화면으로 돌아오면 새 이탈 확정을 다시 허용한다.
- 퀴즈 제출과 next-part 이전에 Python의 제어 ACK 및 Spring 전송 큐 완료를 기다린다.
  미전송 확정 이벤트가 남으면 해당 API를 진행하지 않고 기존 오류 처리를 사용한다.
- 독서 종료 전에는 열려 있는 확정 구간을 독서 종료 시점까지 기록하고 전송을 완료한다.
  이후 기록 ID/추적기를 정리한다. 카메라를 종료하거나 상호작용 이벤트를 끄지 않는다.
- 정상 종료 요청 없이 창이 닫히거나 연결이 끊기면 5초 주기 갱신이 끊긴 뒤
  60초 세션 유효기간 만료로 기록을 중단한다. 갑작스러운 종료는 즉시 확인할 수 없다.

기록 제어는 기존 `/api/session`, `/api/focus`, `/api/events`의 의미를 변경하지 않는
별도 로컬 endpoint이다. Spring의 새 endpoint는 만들지 않았다.

## 한 구간의 시간 및 ID

**SIDE/BACK/ABSENT를 하나의 연속 이탈로 추적하고 monotonic 시계로 10초를 확인한다.
10초 이전에는 UUID와 확정 요청을 만들지 않는다. 10초 이상이 처음 관측되면
UUID를 한 번만 생성한다. 30초 지속하거나 이탈 상태 종류가 바뀌어도 ID를 유지한다.

기록 전용 복귀 판정은 기존 스무딩 결과가 FRONT로 1초 유지되는지 확인한다.
복귀 시간은 안정화 확인 시점이 아니라 그 FRONT 구간이 시작된 시점으로 기록한다.
한 프레임의 FRONT는 구간을 분리하지 않는다. 이는 기존 캐릭터 복귀 로직과 별개이다.

실제 프레임 관측 간격 때문에 최초 durationSeconds는 10 또는 그 이상의 정수일 수 있다.
표준 datetime.isoformat으로 다음 Spring DTO**만 전송한다.

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "focus_lost",
  "occurredAt": "2026-09-18T10:15:30",
  "durationSeconds": 10
}
```

30초 시점에 FRONT로 복귀한 경우:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "focus_recovered",
  "occurredAt": "2026-09-18T10:15:50",
  "durationSeconds": 30
}
```

URL은 `POST {BACKEND_BASE_URL}/api/reading-histories/{readingHistoryId}/focus-events`.
partType/level/state/readingHistoryId는 Spring JSON body에 넣지 않는다.
Spring은 현재 ReadingLog의 파트/레벨을 사용하며 동일 eventId의 복귀는 같은 행을 갱신한다.

Spring DTO는 offset 없는 LocalDateTime이다. **FOCUS_TIME_ZONE은 Backend JVM의
실제 시간대와 일치하도록 반드시 설정한다.** Pi OS 시간대가 달라도 해당 ZoneInfo로
변환한 시각을 사용한다. UTC는 Python 표준 timezone을 사용한다.
초 단위의 시작 시각을 고정하고 monotonic 경과 초를 더하므로 확정·복귀 간 시각 차이가
Spring의 durationSeconds 검증과 일치한다. NTP 시각 보정도 진행 중인 구간 길이를 바꾸지 않는다.
시작 시각의 정확성은 장치 시계 동기화가 필요하다. DST 전환 경계는 LocalDateTime 계약의
제약이므로 UTC 또는 DST 없는 시간대 운용을 권장한다.

## 재시도와 한계

- 새 이벤트는 즉시 전송 큐에 넣는다. 큐가 비어 있으면 바로 HTTP를 시작한다.
- 요청 timeout 3초, 최대 4회, 재시도 대기 1/2/4초. ID와 body를 바꾸지 않는다.
- 408/429 및 서버/네트워크 실패는 재시도하며, 나머지 4xx는 즉시 보류한다.
- 확정 요청의 SAVED/ALREADY_PROCESSED를 확인한 뒤 복귀 요청을 전송한다.
- 모든 시도 실패 시 메모리에 보류하고 다음 명시적 flush에서 같은 요청을 재시도한다.
  메모리 FIFO는 최대 128개이며 한도 초과는 오류로 기록하고 진행 전 검증에서 거부한다.
- 새 UUID를 만드는 자동 재전송은 없다. 로컬 Node/Python 프로세스 재시작까지 보존하는
  디스크 큐는 구현하지 않았다. Python 종료 시 기존 카메라 재시작 동작은 유지하지만
  기록 ID가 유실된 세션은 오류 상태로 두어 같은 이탈에 새 ID를 자동 발급하지 않는다.
- 정상 종료는 마지막 전송을 기다린다. 강제 종료/세션 만료로 취소된 요청이 이미 서버에서
  처리됐는지는 응답 없이는 확정할 수 없고, 마지막 복귀 시간이 누락될 수 있다.
- 같은 ID를 재사용해도 DB UNIQUE가 실제로 적용되어 있어야 최종 중복 방지가 완성된다.

Python ACK와 FIFO 완료를 기다리는 정상 퀴즈/next-part 경로의 지연 귀속 위험을 줄였다.
하지만 다른 클라이언트가 직접 next-part를 호출하거나 프로세스가 재시작되는 경우까지
분산 트랜잭션으로 묶지는 않는다. 파트 경계를 가로지르는 이미 확정된 구간은 최초 행에
계속 귀속되며 새로운 행을 만들지 않는다.

## 실제 Pi 실행 및 확인

운영 DB 변경은 실행하지 않았다. 먼저 관리자가 [4단계 SQL](../../backend/docs/focus-events-stage4.md)의
event_id 컬럼, 복합 UNIQUE, 필요한 state 제약을 적용해야 한다.
Node.js 24와 기존 카메라 Python 환경/모델이 필요하다. 새 모델이나 무거운 라이브러리는 추가하지 않았다.

Backend JVM 시간대는 실행 서버에서 다음처럼 확인한다. 실제 Java PID를 사용한다.

```bash
jcmd JAVA_PID VM.system_properties | grep '^user.timezone='
```

아래 예시는 Backend JVM이 UTC인 경우이다. 실제 경로와 origin으로 바꾼다.
첫 번째 터미널에서 기존 상호작용 서버를 실행한다. 이미 실행 중이라면 중복 실행하지 않는다.

```bash
cd /path/to/story-dream_back
export BACKEND_BASE_URL='https://your-backend-origin'
export FOCUS_TIME_ZONE=UTC
export FOCUS_SOURCE=camera
export CAMERA_FOCUS=1
export NO_BROWSER=1
export PYTHON_BIN=/home/pi/yolo-env/bin/python
bash AI/realtimeinteraction/start.sh 2>&1 | tee /tmp/story-dream-focus.log
```

BACKEND_BASE_URL이 없으면 AppConfig가 기존 VITE_BACKEND_PROXY_TARGET 환경값을 재사용한다.
둘 다 없으면 기록을 허용하지 않는다. 설정값은 실제 origin이어야 하며 `/api`를 덧붙이지 않는다.
기존 AI .env 로더도 사용할 수 있고, 이미 export한 값이 파일보다 우선한다.

두 번째 터미널에서 React 런처를 실행한다.

```bash
cd /path/to/story-dream_back
export VITE_BACKEND_PROXY_TARGET='https://your-backend-origin'
export VITE_FOCUS_SOURCE=camera
bash frontend/rpi/story-dream-launch.sh
```

VITE_FOCUS_SOURCE는 기록 연동 검증용이다. Pi 배포에서 Node가 잘못 browser 모드로 실행됐거나
접속되지 않는 상황을 조용히 건너뛰지 않게 한다. 기존 상호작용 소스를 변경하는 변수는 아니다.
자동실행 환경은 `~/.config/story-dream/launcher.env`에 프론트용 값을 export한다.
런처는 기존처럼 React만 실행한다. 기존 Node 서버의 별도 기동/자동실행 구성이 필요하다.

모니터링은 이번에 추가한 기록 전용 조회 endpoint를 사용한다.

```bash
curl -fsS http://127.0.0.1:4000/api/session
curl -fsS http://127.0.0.1:4000/api/focus/session
tail -f /tmp/story-dream-focus.log
```

기대 값/로그:

- `/session`: `focus.source="camera"`
- `/focus/session`: `processRunning=true`; 독서 시작 후 `recording.readingHistoryId`가 UI의 ID와 같음
- 읽기 화면에서 `recording.detect=true`, 퀴즈/상호작용 화면에서는 false
- `[camera-focus] model ready`, `[camera-focus] running`
- `[focus-backend] send history=... event=... type=focus_lost attempt=1`
- `[focus-backend] ack event=... status=SAVED logId=...`
- 복귀 시 같은 eventId, `type=focus_recovered`, `status=RECOVERED`
- 재시도 시 같은 eventId, 증가하는 attempt, 성공 후 `pendingEvents=0`
- 종료 후 `recording.readingHistoryId=null`. 기존 카메라와 상호작용은 유지됨

실기기 확인 순서:

1. UI에서 독서를 시작하고 Backend가 발급한 실제 ID를 확인한다.
2. SIDE 5초 후 정면: 기록 전송이 없어야 한다.
3. SIDE 10초 이상: SAVED 한 번. SIDE/BACK/ABSENT로 바꾸며 30초 유지해도 새 ID 없음.
4. 정면 1초 이상: 같은 ID에 RECOVERED. 새 이탈 10초에는 새 ID.
5. 기존 캐릭터 반응·복귀가 기존 기준대로 작동하는지 별도로 확인한다.
6. 네트워크를 잠시 끊어 동일 ID 재시도, 복구 후 pendingEvents=0을 확인한다.
7. pending 상태에서는 퀴즈/next-part가 먼저 진행되지 않는지 확인한다.
8. 종료 후 Backend 기록 전송이 멈추고 기존 상호작용은 유지되는지 확인한다.
9. Backend에서 실제 history ID의 FocusLog 행 개수·durationSec과 난이도/next-part 결과를 확인한다.

## 자동화 검증과 실기기 검증의 구분

```bash
python3 -B AI/realtimeinteraction/tests/test_focus_episode.py
node --test AI/realtimeinteraction/tests/focus-recording.test.js
cd frontend
node --test tests/focus-session.test.cjs
npm run lint
npm run build
```

- Python 12개: 연속 구간, 임계값, 단일 ID, 복귀 debounce/전체 시간, 종료, 시간 계산.
- Node 10개: HTTP body/동일 ID 재시도/FIFO/보류/취소/세션 전달/기존 SSE 보존.
- 프론트 API 5개: 기록 완료 전 퀴즈·next-part 방지, selectedLevel 보존, 종료 순서.
- 기존 Backend: 57개 중 56개 성공. contextLoads 1개는 기존 JDBC metadata/방언 설정 실패.
- lint 오류 0, 기존 StoryReadingPage Hook 경고 1. 빌드 성공.

위 테스트는 Pi 카메라, YOLO 추론 속도, 실제 네트워크, 운영 PostgreSQL 스키마 적용을
검증하지 않았다. 감지 모델/기존 타이머 변경 여부는 diff로 검수했고 하드웨어 동작은 위 절차로 확인해야 한다.
Spring focus-events의 기존 permitAll 정책은 유지한다. 장치 인증은 별도 개선 사항이다.
