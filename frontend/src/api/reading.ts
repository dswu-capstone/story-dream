import type { StoryPage } from "../types/story";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string | null;
};

export type ReadingPartResult = {
  partType: string;
  partOrderNum: number;
  level: number;
  pages: StoryPage[];
};

export type ReadingStartResult = ReadingPartResult & {
  readingHistoryId: number;
};

async function parseResponse<T>(response: Response, fallbackMessage: string) {
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? fallbackMessage);
  }

  return result.data;
}

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

export async function startReading(
  childId: number,
  originalStoryId: number,
): Promise<ReadingStartResult> {
  const response = await fetch("/api/reading-histories/start", {
    method: "POST",
    headers: getAuthorizationHeaders(),
    body: JSON.stringify({ childId, originalStoryId }),
  });

  return parseResponse<ReadingStartResult>(
    response,
    "동화 읽기를 시작하지 못했습니다.",
  );
}

export async function getNextReadingPart(
  readingHistoryId: number,
  selectedLevel: number,
): Promise<ReadingPartResult> {
  const response = await fetch(
    `/api/reading-histories/${readingHistoryId}/next-part`,
    {
      method: "POST",
      headers: getAuthorizationHeaders(),
      body: JSON.stringify({ selectedLevel }),
    },
  );

  return parseResponse<ReadingPartResult>(
    response,
    "다음 동화 파트를 불러오지 못했습니다.",
  );
}

export async function endReading(readingHistoryId: number): Promise<void> {
  const response = await fetch(
    `/api/reading-histories/${readingHistoryId}/end`,
    {
      method: "PATCH",
      headers: getAuthorizationHeaders(),
    },
  );

  await parseResponse<null>(response, "동화 읽기를 종료하지 못했습니다.");
}
