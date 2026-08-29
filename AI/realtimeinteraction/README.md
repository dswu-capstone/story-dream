# realtimeinteraction — Story Dream 통합 앱

동화 리딩 세션 전체가 **하나의 앱**으로 동작합니다. `./start.sh` 하나면
파이 디스플레이에 키오스크로 전 과정이 흘러갑니다:

```
① 목소리 등록  ──(reference_user.wav 있으면 "넘어가기")──▶  ② 서재(책 표지 그리드)
        │                                                        │ 책 클릭
        ▼                                                        ▼
   문장 10개 따라 말하기                          ③ 나레이션 생성 (버퍼링 + 진행률)
   → dataset/reference_user.wav                     Fish Audio 보이스 클로닝,
                                                    level1 앞 3장 준비되면 바로 입장
                                                         │
                                                         ▼
                                              ④ 리더: 터치로 넘기며 TTS 재생
                                                 + 카메라 집중 감지 → 퀴즈 캐릭터
```

## 실행

```bash
cd /home/pi/storydream/realtimeinteraction
OPENAI_API_KEY=... FISH_AUDIO_API_KEY=... ./start.sh
```

- `OPENAI_API_KEY` 없으면 퀴즈 캐릭터만 꺼진 채 동작
- `FISH_AUDIO_API_KEY` 없으면 나레이션 생성 없이 리더로 바로 입장
- `NO_BROWSER=1` 서버만 실행 / `CAMERA_FOCUS=0` 카메라 감지 끔
- 개발용: `http://localhost:4000/?screen=library` 또는 `?screen=reader`

## 구조 (웹서버/DB 연동을 위한 객체 설계)

```
realtimeinteraction/
├── start.sh                 # 서버 + 파이 화면 키오스크
├── dataset/                 # 책 jsonl + 표지 jpg + 보이스 레퍼런스
│   ├── gongu_0059_미운 아기 오리.jsonl   # ← jsonl을 더 넣으면 서재에 책이 늘어남
│   ├── 미운_아기_오리.jpg               # 제목과 같은 이름(공백↔_)이면 표지로 사용
│   ├── reference_1min.wav               # 기본 레퍼런스
│   └── reference_user.wav               # 등록 화면이 만드는 사용자 레퍼런스
└── app/
    ├── server.js            # 부트스트랩 + HTTP 라우팅만
    ├── lib/                 # ★ DB 연동 시 교체 지점이 되는 서비스 클래스들
    │   ├── AppConfig.js         # env → 설정 객체
    │   ├── StoryRepository.js   # 책 카탈로그 (지금: jsonl 스캔 → 나중: DB)
    │   ├── VoiceProfileStore.js # 녹음 보관·레퍼런스 합성 (→ 오브젝트 스토리지)
    │   ├── NarrationService.js  # TTS 생성 잡 + 진행률 (→ 서버 큐)
    │   ├── ReadingSession.js    # 현재 책/페이지 (→ 아이별 진도 저장)
    │   ├── QuizLogStore.js      # 퀴즈 결과 jsonl (→ DB 테이블)
    │   ├── RealtimeGateway.js   # OpenAI Realtime SDP 프록시
    │   ├── FocusMonitor.js      # camera_focus.py 프로세스 관리
    │   └── SseHub.js            # 상태 push (→ WebSocket)
    ├── public/
    │   ├── index.html / styles.css
    │   ├── js/main.js           # App: 화면 흐름 오케스트레이터
    │   ├── js/api.js            # ApiClient (base URL만 바꾸면 원격 서버)
    │   ├── js/enroll.js         # EnrollScreen (발화 감지 녹음)
    │   ├── js/library.js        # LibraryScreen + LoadingOverlay
    │   ├── js/reader.js         # ReaderScreen + RealtimeClient (퀴즈 사이클)
    │   └── assets/              # background.jpg, duck.jpg, characters/, audio/<bookId>/
    ├── camera_focus.py      # YOLO pose(ONNX) → /api/focus
    ├── voice_cloning.py     # Fish Audio TTS, PROGRESS 라인으로 진행률 보고
    └── build_reference.py   # 녹음 → 레퍼런스 WAV (ffmpeg)
```

## 주요 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/session` | 부팅 정보 (레퍼런스 유무, 키 유무, 진행 중인 책) |
| GET | `/api/books` | 책 목록 + 나레이션 준비 상태 |
| POST | `/api/books/:id/narration` | 나레이션 생성 시작 (GET = 상태 조회) |
| POST | `/api/books/:id/open` | 책 열기 (리더 입장) |
| GET/POST | `/api/state` | 현재 페이지/레벨 조회·변경 |
| POST | `/api/voice/recordings?index=N` | 등록 녹음 업로드 |
| POST | `/api/voice/finalize` | 레퍼런스 합성 |
| POST | `/api/focus` | camera_focus.py의 집중 이벤트 |
| POST | `/api/quiz-log` | 퀴즈 결과 기록 (`app/logs/quiz-log.jsonl`) |
| POST | `/api/call` | OpenAI Realtime SDP 교환 |
| GET | `/api/events` | SSE: state / focus / narration / quizlog |

## 참고

- 한글/이모지 폰트: `~/.local/share/fonts/`에 Noto Sans KR + Noto Color Emoji 설치됨
- 퀴즈 캐릭터 감정 이미지: `app/public/assets/characters/{happy,sad,angry,scared}.jpg`
  를 넣으면 자동 사용 (없으면 duck.jpg 폴백)
- 옛 분리형 코드(story-display, voice-enroll)의 원본은
  `/home/pi/storydream/storydream/story-dream/`에 그대로 있음
