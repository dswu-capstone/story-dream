# EC2 자동 배포

`.github/workflows/deploy-ec2.yml`은 `main` 푸시 시 GitHub Actions에서 SSH로 EC2에 접속하여 기존 저장소의 최신 `main`을 받아 이미지를 빌드하고 컨테이너를 교체한다. GitHub Actions의 **Deploy to EC2 → Run workflow → main**으로 수동 재실행할 수도 있다.

## 최초 설정

GitHub 저장소의 **Settings → Secrets and variables → Actions → Secrets**에 다음 Repository secrets를 등록한다. 실제 값은 저장소 파일이나 채팅에 기록하지 않는다.

| Secret | 값 |
| --- | --- |
| `EC2_HOST` | EC2의 접속 가능한 IP 또는 DNS 이름. 프로토콜·포트 제외 |
| `EC2_USER` | 기존 배포 사용자 이름(예: Ubuntu의 `ubuntu`) |
| `EC2_SSH_KEY` | 해당 사용자로 접속 가능한 SSH 개인키 전체. 무인 접속용 암호 없는 전용 키 권장 |
| `EC2_KNOWN_HOSTS` | 신뢰할 수 있는 경로로 확인한 EC2 SSH 호스트 공개키의 known_hosts 항목 |
| `EC2_PROJECT_PATH` | EC2에 이미 clone한 저장소의 절대 경로 |

## EC2 사전 조건

- Linux의 Bash, Git, `flock`, Docker Engine, Docker Compose v2가 설치되어 있어야 한다. Compose는 `up --wait --wait-timeout`을 지원해야 한다.
- `EC2_USER`가 비대화형 SSH 접속과 `sudo` 없는 Docker 실행, 프로젝트 디렉터리 쓰기를 할 수 있어야 한다.
- 저장소는 `main` 브랜치이며 로컬 수정이나 미추적 파일, 서버 전용 커밋이 없어야 한다. Git에서 무시하는 `.env`는 유지된다.
- `git fetch origin main`이 사용자 입력 없이 가능해야 한다. 비공개 저장소는 **EC2 → GitHub** 읽기 권한(예: 읽기 전용 Deploy key)을 별도로 설정해야 한다. Actions의 EC2 접속 키가 이를 대신하지 않는다.
- 기존 `backend/.env`, `AI/ai-server/.env` 파일이 서버에 있어야 한다. 워크플로는 이 파일을 생성하거나 덮어쓰지 않는다. `frontend/.env`는 이 배포에 사용하지 않는다.
- GitHub 호스팅 runner에서 EC2 SSH 포트로 접근 가능해야 한다. 보안 그룹을 개인 PC IP로만 제한했다면 실행되지 않는다. runner IP는 고정되지 않으므로 제한된 접근이 필요하면 고정 송신 IP runner 또는 별도의 self-hosted runner 구성이 필요하다.

기존 서버에서 배포 사용자로 다음을 확인한다.

```bash
git branch --show-current
git status --short
git fetch origin main
docker compose version
docker compose config --quiet
docker compose ps
```

## 실행 순서와 실패 처리

1. 필수 Secrets와 SSH 서버 키를 검증한다.
2. 서버의 배포 잠금을 획득하고 작업 트리와 브랜치를 확인한다.
3. `git fetch origin main`과 `git merge --ff-only origin/main`으로 최신 main으로 갱신한다. 강제 reset이나 파일 삭제를 하지 않으며, 브랜치가 갈라지거나 서버 전용 커밋이 있으면 중단한다.
4. `.env` 파일 존재와 Compose 구성을 확인한다. `config --quiet`는 환경변수 값을 출력하지 않고 유효성만 확인한다.
5. `docker compose build ai-server backend`로 두 이미지를 빌드한다. 이 단계가 실패하면 기존 컨테이너는 계속 실행된다.
6. `docker compose up -d --no-build --wait --wait-timeout 180 ai-server backend`로 변경된 컨테이너를 교체하고 상태를 기다린다.

`-d`는 백그라운드 실행, `--no-build`는 앞서 빌드한 이미지 사용, `--wait`는 실행/헬스체크 상태 확인, `--wait-timeout 180`은 상태 확인 제한 시간을 뜻한다. 
GitHub `concurrency`는 배포를 직렬화하며 실행 중 배포는 취소하지 않는다. 추가 푸시가 몰리면 대기 중 실행이 최신 실행으로 대체될 수 있다. 서버의 `flock`도 같은 잠금을 사용하는 배포의 동시 실행을 차단한다. 수동으로 실행하는 다른 Compose 명령까지 차단하는 것은 아니다.

배포 대상은 **실행 당시 fetch한 최신 main**이다. 과거 workflow를 재실행해도 과거 커밋으로 되돌리지 않는다. 실제 배포 SHA는 로그의 `Deploying commit`에서 확인한다.

현재 AI 서비스에는 `/health` 헬스체크가 있고 백엔드에는 헬스체크가 없다. 따라서 성공은 **AI healthy + 백엔드 running**을 의미하며, 백엔드 API와 DB 연결까지 보장하지 않는다. 

이 구성은 단일 EC2 Compose 배포로 컨테이너 교체 중 짧은 중단이 가능하다. 시작 실패 시 Actions는 실패하고 자동 롤백하지 않는다. EC2에서 `docker compose logs --tail 100 backend ai-server`로 원인을 확인하고 수정한 뒤 다시 실행한다. 빌드 캐시는 자동 삭제하지 않으므로 디스크 사용량을 운영 중 점검한다.

## 검증

1. 위 Secrets와 서버 사전 조건을 설정한 뒤 변경 파일을 main에 반영한다.
2. Actions의 **Deploy to EC2** 실행 성공과 배포 SHA를 확인한다.
3. EC2에서 `docker compose ps`로 두 컨테이너 상태를 확인하고 실제 API 요청을 테스트한다.
4. 다음 main 푸시에서 자동 실행되는지 확인한다.

이 워크플로는 배포 자동화다. 현재 Dockerfile의 빌드 단계는 Java 테스트를 실행하지 않으며, 별도 테스트 CI를 추가한 구성은 아니다.
