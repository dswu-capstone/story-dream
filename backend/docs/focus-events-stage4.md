# 확정 이탈 이벤트 API (4단계)

## 계약

기존 `POST /api/reading-histories/{historyId}/focus-events` 경로만 사용한다.
프레임/하트비트 API가 아니다. Pi는 SIDE/BACK/ABSENT를 하나의 연속된 이탈로 추적하고,
10초 이상이 되는 순간 아래 요청을 한 번 생성한다.

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "occurredAt": "2026-09-18T10:15:30",
  "durationSeconds": 10
}
```

- `eventId`: 독서 이력 내에서 유일한 구간 ID, 공백 없는 1~128자. UUID 권장.
- 같은 구간의 상태가 SIDE → ABSENT로 바뀌거나 요청을 재시도해도 ID를 바꾸지 않는다.
  30초 지속해도 하나의 ID이다. 정상 복귀 후 새 이탈에만 새 ID를 사용한다.
- `occurredAt`: 이탈 **확정 시각**. 시작 시각은 `occurredAt - durationSeconds`이다.
  LocalDateTime이므로 Pi와 서버는 동일한 시간대를 사용해야 한다.
- `durationSeconds`: 10 이상의 정수. 영상/연속성 판정은 Pi의 책임이다.
- 선택 필드 `eventType`: 생략 또는 `focus_lost`는 일반 이탈, `absent`는 자리 이탈.
- partType/level은 요청 DTO에 없으며 서버가 최신 ReadingLog에서 결정한다.
- 구형 요청의 partType/level/detail만 보내거나 `focus_state`를 보내면 저장되지 않는다.

공통 ApiResponse를 사용한다. 최초 저장은 다음과 같다.

```json
{"success":true,"data":{"logId":123,"status":"SAVED"},"message":null}
```

같은 historyId/eventId의 재전송은 원래 logId와 `ALREADY_PROCESSED`를 반환한다.
잘못된 값은 400과 `success:false`, 없는 독서 기록/ReadingLog는 404이다.
새 eventId를 매번 발급하는 송신 오류는 백엔드가 동일 구간이라고 판단할 수 없다.

## 리포트의 전체 이탈 시간 유지

확정 시점에는 미래의 복귀 시각을 알 수 없다. 따라서 최초 저장은
`durationSec=10`, `endedAt=null`이며, **10초는 확인된 최소 시간**이다.
리포트의 전체 시간을 보존하려면 Pi가 정상 복귀 시 같은 경로로 다음을 보낸다.

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "focus_recovered",
  "occurredAt": "2026-09-18T10:15:50",
  "durationSeconds": 30
}
```

이미 저장된 행만 `endedAt`/`durationSec`를 갱신하고 `RECOVERED`를 반환한다.
재전송은 `ALREADY_PROCESSED`이다. 복귀 초는 저장된 시작 시각과 일치해야 한다.
없는 eventId의 복귀는 404이므로 확정 요청 성공 후 복귀를 전송/재시도해야 한다.
파트 전환 후 복귀해도 최초 eventId의 행을 갱신한다.
독서 종료 시 `ReadingHistoryService.complete()`의 기존 `closeAllOpen()`도 유지한다.
별도 `ReadingServiceImpl.endReading()`은 원래부터 이 경로를 호출하지 않는다.
복귀 유실, 종료 경로 차이, 이미 생성된 리포트의 사후 갱신은 이번 단계에서 바꾸지 않는다.

기존 리포트 COUNT/SUM 쿼리는 그대로이다. 과거 eventId=null 행을 삭제하거나
자동 변환하지 않는다. 난이도 COUNT는 `eventId IS NOT NULL AND durationSec >= 10`만 포함한다.
따라서 과거 리포트의 전체 로그 횟수와 확정 이벤트만 세는 난이도 횟수는 다를 수 있다.

## 동시성 및 파트 귀속

하나의 @Transactional에서 ReadingHistory를 PESSIMISTIC_WRITE로 잠그고
eventId 조회 → 최신 ReadingLog 조회 → saveAndFlush를 수행한다.
퀴즈/next-part도 같은 부모 행을 잠그므로 중간 상태를 읽지 않는다.
동일 이력의 동시 이벤트 요청은 직렬화되며 DB UNIQUE가 추가로 중복을 막는다.
이미 처리된 ID는 최신 파트를 다시 적용하지 않는다.

신규 이벤트는 **처리 순서상의 최신 파트**에 귀속된다. next-part가 먼저 커밋한 뒤
처음 도착한 서론 이벤트는 본론으로 귀속될 수 있다. ReadingLog.createdAt은 있지만
구간 종료 시각과 공통 시계 기준이 없으므로 occurredAt만으로 과거 귀속을 추정하지 않는다.
다음 단계에서 Pi 큐의 미전송 이벤트 처리 후 파트 전환하도록 조정하거나,
시계 동기화 및 시간 기준 귀속 정책을 합의해야 한다.
퀴즈 응답 이후 도착한 이벤트는 next-part 재계산 결과에도 영향을 줄 수 있다.

## 실제 PostgreSQL에 필요한 수동 변경 (자동 실행 안 함)

현재 `ddl-auto=validate`. Flyway/Liquibase 및 저장소 SQL 마이그레이션은 없다.
운영 DB의 실제 제약 이름/타입을 연결해서 확인하지 않았다.
배포 전 관리자가 백업 및 기존 스키마를 확인하고 적용해야 한다.
Hibernate 엔티티 선언만으로 기존 DB의 컬럼/UNIQUE가 생성되지 않는다.
validate를 통과하더라도 UNIQUE 적용 여부는 별도로 확인한다.

```sql
BEGIN;
ALTER TABLE focus_log ADD COLUMN event_id VARCHAR(128);
ALTER TABLE focus_log
    ADD CONSTRAINT uk_focus_log_history_event
    UNIQUE (reading_history_id, event_id);
COMMIT;
```

nullable은 과거 로그를 위한 것이다. PostgreSQL의 일반 UNIQUE는 여러 null 행을 허용한다.
같은 eventId라도 다른 ReadingHistory이면 별개 구간으로 취급한다.
과거 행에는 임의의 eventId를 채우지 않는다.

자세가 생략된 요청을 특정 자세로 오인하지 않도록 FocusStatus에 `DISTRACTED`를 추가했다.
state 컬럼에 DB CHECK 또는 별도 enum 제약이 있다면 이 값도 허용해야 한다.
아래 조회로 실제 제약 이름과 기존 허용 값을 먼저 확인한다.

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'focus_log'::regclass;

SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = current_schema() AND table_name = 'focus_log';
```

예를 들어 state의 CHECK 이름이 실제로 `focus_log_state_check`이고 기존 허용 값이
FRONT/SIDE/BACK/ABSENT인 경우에만 다음 SQL을 적용한다. 다른 이름이면 확인한 이름을 사용한다.
state가 PostgreSQL enum 타입이라면 해당 enum 타입에 DISTRACTED를 추가하는 별도 변경이 필요하다.

```sql
BEGIN;
ALTER TABLE focus_log DROP CONSTRAINT focus_log_state_check;
ALTER TABLE focus_log ADD CONSTRAINT focus_log_state_check
    CHECK (state IN ('FRONT', 'SIDE', 'BACK', 'ABSENT', 'DISTRACTED'));
COMMIT;
```

## 인증 및 후속 Pi 작업

SecurityConfig에서 현재 경로는 permitAll, CSRF 비활성이다. JWT 없이 요청할 수 있으나
장치 인증/독서 소유권 검증이 없는 기존 정책이므로 외부 공개 전 인증 방식을 정해야 한다.
이번 변경은 SecurityConfig나 인증 체계를 수정하지 않는다. HTTP 이벤트 전송이면 충분하며
이 수신 API에 WebSocket/SSE나 영상 전송은 필요하지 않다.

확인한 코드 위치:

- `frontend/rpi/story-dream-launch.sh`: Vite/Chromium 실행. 감지기나 Spring 전송기를 실행하지 않는다.
- `AI/realtimeinteraction/app/camera_focus.py`: 카메라 감지 코드. 현재 기본 임계값 15초,
  side/back과 absent 별도 타이머. 다음 단계에서 실제 배포 감지기로 선택된다면
  10초 통합 구간 추적, 안정적인 ID, historyId 연결, 재시도 큐, 복귀 처리가 필요하다.
- `AI/realtimeinteraction/app/lib/FocusMonitor.js`: Python 프로세스 실행 및 로컬 SSE 전달.
  실제 브리지로 채택할 때만 확정 이벤트 ID를 보존하는 전달 경로를 구현한다.
- `frontend/src/api/focusInteraction.ts`: 브라우저 감지 경로에도 15초/별도 타이머가 있다.
  Pi 감지와 동시 사용 시 이중 송신을 피하도록 감지 주체를 결정해야 한다.

realtimeinteraction의 HTML/CSS/HTTP 예제를 서비스 계약으로 사용하지 않았다.
현재 런처만으로 실제 배포 감지 경로를 확정할 수 없다. 위 파일은 읽기만 했으며,
Pi/프론트 연결 구현은 다음 단계에서 배포 경로를 확인한 후 진행한다.
