type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string | null;
};

type RecommendationExposureResponse = {
  recommendationExposureId: number;
  alreadyProcessed: boolean;
};

type StoryClickResponse = {
  storyClickId: number;
  alreadyProcessed: boolean;
};

export type RecommendationTrackingContext = {
  recommendationId: number;
  originalStoryId: number;
  viewSessionId: string;
  recommendationExposureId?: number;
};

function getAuthorizationHeaders() {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(response: Response, fallbackMessage: string) {
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? fallbackMessage);
  }

  return result.data;
}

export async function recordRecommendationExposure(
  recommendationId: number,
  originalStoryId: number,
  viewSessionId: string,
): Promise<number> {
  const response = await fetch(
    `/api/recommendations/${recommendationId}/exposures`,
    {
      method: "POST",
      headers: getAuthorizationHeaders(),
      body: JSON.stringify({ originalStoryId, viewSessionId }),
    },
  );

  const result = await parseResponse<RecommendationExposureResponse>(
    response,
    "추천 노출을 기록하지 못했습니다.",
  );
  return result.recommendationExposureId;
}

export async function recordRecommendationClick(
  recommendationExposureId: number,
): Promise<void> {
  const response = await fetch(
    `/api/recommendation-exposures/${recommendationExposureId}/click`,
    {
      method: "POST",
      headers: getAuthorizationHeaders(),
    },
  );

  await parseResponse<StoryClickResponse>(
    response,
    "추천 클릭을 기록하지 못했습니다.",
  );
}
