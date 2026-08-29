# AI 추천 모듈

짧은 관심사 키워드와 동화 태그·주제의 임베딩을 비교하는 Python 추천
서비스

## 폴더 구조

```text
AI/recommendation/
├─ recommendation_api.py       # FastAPI 진입점
├─ recommendation_engine.py    # 추천 점수 계산
├─ interest_extractor.py       # 관심사 키워드 전처리
├─ embedding_client.py         # OpenAI 임베딩 호출
├─ metadata_embedding_store.py # 임베딩 JSON 로더
├─ environment.py              # 프로젝트 루트 .env 로더
├─ requirements.txt
└─ data/
   ├─ generated_story_metadata.json
   └─ story_metadata_embeddings.json
```

## 반영한 점수 규칙

1. 태그·주제 가중치와 정확 일치 보너스를 적용한다.
2. 최종 매칭 점수가 `0.50` 미만이면 관련 없는 매칭으로 처리한다.
3. 최대 가중치 1:1 매칭을 사용하여 같은 메타데이터가 여러 관심사를
   반복해서 설명하지 못하게 한다.
4. 상위 두 매칭을 `70:30`으로 집계한다.
5. 전체 관심사 중 실제 매칭된 비율로 최종 점수를 `70~100%` 보정한다.

기본 점수는 다음과 같다.

```text
focused = 0.7 × top1 + 0.3 × top2
coverage = matched_interest_count / interest_count
final = focused × (0.7 + 0.3 × coverage)
```

## 최초 설치

프로젝트 루트의 `.env`에 `OPENAI_API_KEY`가 있어야 한다.

```powershell
pip install -r AI/recommendation/requirements.txt
```

AI 추천 서버에 필요한 환경 변수:

```dotenv
OPENAI_API_KEY=...
```


## 임베딩 모델 설정

임베딩 모델은 환경변수로 선택하지 않는다. AI 서버가
`AI/recommendation/data/story_metadata_embeddings.json`에 기록된 모델과 벡터
차원을 읽는다.

현재 설정:

- 모델: `text-embedding-3-small`
- 벡터 차원: `1536`


## 필수 데이터

추천 서버 배포 시 다음 파일을 포함해야 한다.

- `AI/recommendation/data/story_metadata_embeddings.json`

## 추천 API 실행

```powershell
uvicorn AI.recommendation.recommendation_api:app --host 0.0.0.0 --port 8000
```

서버 시작 시 사전 생성한 메타데이터 임베딩을 한 번만 메모리에 올린다.
상태 확인:

```powershell
Invoke-RestMethod http://localhost:8000/health
```
