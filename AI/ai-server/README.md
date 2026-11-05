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
6. 행동 로그가 있으면 클릭·독서 진행 단계로 행동 프로필을 만들고
   관심사 점수 70%, 행동 유사도 30%를 합산한다.
7. 완독한 동화는 행동 점수로 같은 동화 자체를 다시 올리지 않고,
   메타데이터가 유사한 다른 동화를 올린다.

기본 점수는 다음과 같다.

```text
focused = 0.7 × top1 + 0.3 × top2
coverage = matched_interest_count / interest_count
final = focused × (0.7 + 0.3 × coverage)
```

행동 신호의 상대 가중치는 다음과 같다.

```text
클릭 0.25 < 독서 시작 0.45 < 본론 완료 0.75 < 전체 완독 1.00
behavior-aware final = 0.7 × interest_score + 0.3 × behavior_score
```

긍정 행동이 하나도 없으면 기존 `interest_score`를 그대로 최종 점수로
사용한다. API 응답은 오프라인 비교를 위해 `score`, `interestScore`,
`behaviorScore`, `behaviorApplied`를 함께 반환한다.

Spring은 원본 이벤트 전체가 아니라 동화별 집계값을 전달한다.

```json
{
  "interests": ["동물", "우주"],
  "languageCode": "ko",
  "readingBehaviors": [
    {
      "originalStoryId": 101,
      "exposureCount": 3,
      "clickCount": 1,
      "readingStartCount": 1,
      "bodyCompletionCount": 1,
      "readingCompletionCount": 0
    }
  ]
}
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

## 오프라인 비교 평가

평가 케이스는 후보별 `interestScore`, 최종 `score`, 그리고 이후에 발생한
긍정 행동인 `heldOutPositiveStoryIds`를 포함한다. 긍정 행동은 평가 입력을
만드는 시점에 숨겨 두며 추천 점수 계산에는 사용하지 않는다.

```powershell
cd AI/ai-server
python -m app.recommendation.offline_evaluator `
  --input tests/fixtures/virtual_behavior_eval.json `
  --k 3
```

출력 지표:

- `NDCG@K`: 정답 동화가 얼마나 상위에 배치됐는지
- `Recall@K`: 정답 동화 중 상위 K개에 포함된 비율
- `MRR@K`: 첫 번째 정답 동화의 역순위
- `HitRate@K`: 정답 동화를 하나라도 추천했는지
- 관심사-only 대비 행동 반영 지표 상승량

가상 데이터는 평가기 동작 검증용이며, 운영 품질 결론에는 실제 사용자
로그를 시간순으로 분리한 평가셋을 사용해야 한다.
