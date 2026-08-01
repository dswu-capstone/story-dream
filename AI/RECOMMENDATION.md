# AI 추천 모듈

자유 텍스트 관심사와 동화 태그·주제의 임베딩을 비교하는 Python 추천
서비스다. 동화 메타데이터 임베딩은 미리 생성하며, 실제 추천 요청에서는
사용자 관심사만 임베딩한다.

## 반영한 점수 규칙

1. 태그·주제 가중치와 정확 일치 보너스를 적용한다.
2. 최종 매칭 점수가 `0.50` 미만이면 관련 없는 매칭으로 처리한다.
3. 최대 가중치 1:1 매칭을 사용하여 같은 메타데이터가 여러 관심사를
   반복해서 설명하지 못하게 한다.
4. 상위 두 매칭을 `70:30`으로 집계한다.
5. 전체 관심사 중 실제 매칭된 비율로 최종 점수를 `70~100%` 보정한다.
6. 결과에 매칭 근거와 매칭되지 않은 관심사를 함께 반환한다.

기본 점수는 다음과 같다.

```text
focused = 0.7 × top1 + 0.3 × top2
coverage = matched_interest_count / interest_count
final = focused × (0.7 + 0.3 × coverage)
```

관심사가 하나라면 `focused`는 해당 관심사의 점수를 그대로 사용한다.
임계값과 모든 가중치는 `ScoringConfig`에서 변경할 수 있다.

## 최초 설치

프로젝트 루트의 `.env`에 `OPENAI_API_KEY`가 있어야 한다.

```powershell
pip install -r AI/requirements.txt
```

필요한 환경 변수:

```dotenv
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

`OPENAI_EMBEDDING_URL`을 지정하지 않으면 OpenAI의 기본 Embeddings API를
사용한다.

## 필수 데이터

추천 서버 배포 시 다음 두 파일을 포함해야 한다.

- `data/generated_story_metadata.json`
- `data/story_metadata_embeddings.json`

서버는 원본 메타데이터 해시와 임베딩 아티팩트의 원본 해시가 다르면
시작을 거부한다.

## 추천 API 실행

```powershell
uvicorn AI.recommendation_api:app --host 0.0.0.0 --port 8000
```

서버 시작 시 사전 생성한 메타데이터 임베딩을 한 번만 메모리에 올린다.
상태 확인:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

추천 요청:

```powershell
$body = @{
  interests = @("공주", "마법", "모험", "상상력")
  languageCode = "ko"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8000/recommendations `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

