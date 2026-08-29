import type {
  ReportOverviewResponse,
  ReportPage,
} from "../types/readingReport";
import type { DateRange } from "../utils/reportDate";

type GuardianMeResponse = {
  success: boolean;
  data: { id: number } | null;
  message: string | null;
};

export class ReadingReportApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReadingReportApiError";
    this.status = status;
  }
}

function getAccessToken(): string {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    throw new ReadingReportApiError("로그인이 필요합니다.", 401);
  }
  return token;
}

async function getGuardianId(token: string): Promise<number> {
  const response = await fetch("/api/guardians/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => null)) as GuardianMeResponse | null;

  if (!response.ok || !result?.success || !result.data) {
    throw new ReadingReportApiError(
      result?.message ?? "보호자 정보를 확인할 수 없습니다.",
      response.status,
    );
  }
  return result.data.id;
}

async function requestReport<T>(path: string, token: string, guardianId: number): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Guardian-Id": String(guardianId),
    },
  });

  if (!response.ok) {
    throw new ReadingReportApiError(
      response.status === 401 || response.status === 403
        ? "로그인 정보가 만료되었거나 조회 권한이 없습니다."
        : "독서 요약을 불러오지 못했습니다.",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function getReadingReportData(childId: number, range: DateRange) {
  const token = getAccessToken();
  const guardianId = await getGuardianId(token);
  const query = new URLSearchParams({ from: range.from, to: range.to });
  const historyQuery = new URLSearchParams({
    from: range.from,
    to: range.to,
    page: "0",
    size: "20",
  });

  const [overview, history] = await Promise.all([
    requestReport<ReportOverviewResponse>(
      `/api/children/${childId}/reading-reports/overview?${query}`,
      token,
      guardianId,
    ),
    requestReport<ReportPage>(
      `/api/children/${childId}/reading-reports?${historyQuery}`,
      token,
      guardianId,
    ),
  ]);

  return { overview, history };
}
