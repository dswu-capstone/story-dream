# Realtime 캐릭터 상호작용 스모크 테스트

이 폴더는 Story Dream의 캐릭터 음성 상호작용 흐름을 빠르게 검증하기 위한 브라우저 기반 참고용 테스트 프로젝트입니다.

## 테스트 가능한 항목

- 브라우저에서 OpenAI Realtime API와 WebRTC 연결
- 캐릭터의 첫 질문 음성 생성
- 아이 음성 입력 감지와 후속 응답 생성
- 무응답 시 fallback 멘트 생성
- YOLO 집중 이탈 신호 -> 앱 서버 -> 브라우저 -> Realtime 재질문 흐름

## 실행 위치

이 프로젝트는 `story-dream-branch` 폴더 안에서 아래 위치에 있습니다.

```text
realtime-interaction-smoke-test
```

즉 `story-dream-branch` 폴더로 이동한 뒤, 그 안에서 다시 `realtime-interaction-smoke-test`로 들어가서 실행하면 됩니다.

## 실행 방법

1. `story-dream-branch` 폴더로 이동합니다.
2. `realtime-interaction-smoke-test` 폴더로 이동합니다.
3. `OPENAI_API_KEY`를 설정합니다.
4. 서버를 실행합니다.
5. 브라우저에서 `http://127.0.0.1:3000` 또는 `http://localhost:3000`을 엽니다.

PowerShell 예시:

```powershell
cd .\story-dream-branch
cd .\realtime-interaction-smoke-test
$env:OPENAI_API_KEY="sk-..."
npm start
```

이미 `story-dream-branch` 폴더 안에 있다면:

```powershell
cd .\realtime-interaction-smoke-test
$env:OPENAI_API_KEY="sk-..."
npm start
```

## 프론트에서 눌러야 하는 순서

브라우저를 열었다고 바로 음성이 나오는 것은 아닙니다. 아래 순서대로 눌러야 합니다.

1. `1. 세션 연결`
2. 연결이 성공하면 `2. 질문 시작`

설명:

- `세션 연결`: 브라우저가 Realtime API와 WebRTC 세션을 연결합니다.
- `질문 시작`: 캐릭터가 먼저 말을 걸도록 첫 질문을 생성합니다.
- 이 연결이 먼저 되어 있어야 YOLO 이벤트나 수동 이벤트가 왔을 때 캐릭터 음성이 재생됩니다.

## 수동 이벤트 기반 테스트 방법

YOLO 없이도 상호작용이 되는지 먼저 확인할 수 있습니다.

### 1. 서버 실행

```powershell
cd .\story-dream-branch
cd .\realtime-interaction-smoke-test
$env:OPENAI_API_KEY="sk-..."
npm start
```

### 2. 브라우저에서 접속

- `http://127.0.0.1:3000`

### 3. 프론트에서 버튼 클릭

1. `1. 세션 연결`
2. `2. 질문 시작`

### 4. 수동으로 focus 이벤트 전송

새 PowerShell 창에서:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/focus" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"eventType":"focus_lost","state":"side","detail":"manual test","storyPaused":false}'
```

### 기대 결과

- 화면에 YOLO signal 상태가 갱신됨
- 로그에 focus 이벤트 수신이 표시됨
- 세션 연결이 살아 있으면 캐릭터가 자동으로 다시 말을 검

## YOLO 실행 예시

`story-dream-branch` 폴더 기준:

```powershell
$env:APP_SERVER_URL="http://127.0.0.1:3000"
python .\AI\focus_pose2.py
```

`realtime-interaction-smoke-test` 폴더 안에서 실행한다면:

```powershell
$env:APP_SERVER_URL="http://127.0.0.1:3000"
python ..\AI\focus_pose2.py
```

라즈베리파이 로컬 음성 알림까지 함께 켜고 싶다면:

```powershell
$env:LOCAL_VOICE_ALERT="1"
python .\AI\focus_pose2.py
```

또는 `realtime-interaction-smoke-test` 폴더 안에서는:

```powershell
$env:LOCAL_VOICE_ALERT="1"
python ..\AI\focus_pose2.py
```

## 현재 파이프라인

1. 라즈베리파이의 YOLO가 아이 자세를 보고 `front`, `side`, `back`, `absent` 상태를 판단합니다.
2. YOLO가 집중도 이벤트를 `POST /api/focus`로 전송합니다.
3. 브라우저는 `GET /api/events`를 통해 서버가 푸시하는 이벤트를 구독합니다.
4. `focus_lost` 이벤트가 오면 클라이언트가 Realtime 캐릭터에게 다시 말을 걸도록 요청합니다.
5. `absent` 이벤트가 오면 클라이언트는 자리 이탈 상태로 표시합니다.

## 기본 VAD 설정값

- `threshold`: `0.5`
- `prefix_padding_ms`: `300`
- `silence_duration_ms`: `700`
- `noResponseTimeoutMs`: `10000`

## 참고

- `.env`는 `.gitignore`에 의해 커밋되지 않습니다.
- API 키는 `.env`에만 두고, 저장소에는 올리지 않는 것을 권장합니다.
