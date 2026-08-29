import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getReadingReportData, ReadingReportApiError } from "../../api/readingReport";
import type { ReportOverviewResponse, ReportSummary } from "../../types/readingReport";
import { getMonthRange, shiftMonth, type DateRange } from "../../utils/reportDate";
import AiAnalysisCard from "./AiAnalysisCard";
import PeriodSelector from "./PeriodSelector";
import ReadingSummarySidebar from "./ReadingSummarySidebar";
import WeeklyScoreChart from "./WeeklyScoreChart";
import "./readingSummaryPage.css";

type ErrorState = { message: string; isAuth: boolean } | null;

export default function ReadingSummaryPage() {
  const navigate = useNavigate();
  const { childId: childIdParam } = useParams<{ childId: string }>();
  const childId = Number(childIdParam);
  const [range, setRange] = useState<DateRange>(() => getMonthRange());
  const [overview, setOverview] = useState<ReportOverviewResponse | null>(null);
  const [history, setHistory] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorState>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      await Promise.resolve();
      if (!Number.isInteger(childId) || childId <= 0) {
        if (isActive) {
          setError({ message: "올바른 아동 정보가 필요합니다.", isAuth: false });
          setIsLoading(false);
        }
        return;
      }
      try {
        const data = await getReadingReportData(childId, range);
        if (isActive) {
          setOverview(data.overview);
          setHistory(data.history.content);
        }
      } catch (caught) {
        const apiError = caught instanceof ReadingReportApiError ? caught : null;
        if (isActive) {
          setError({
            message: apiError?.message ?? "독서 요약을 불러오는 중 오류가 발생했습니다.",
            isAuth: apiError?.status === 401 || apiError?.status === 403,
          });
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void retryCount;
    void load();
    return () => { isActive = false; };
  }, [childId, range, retryCount]);

  const changeRange = (offset: number) => {
    setIsLoading(true);
    setError(null);
    setRange((value) => shiftMonth(value, offset));
  };

  const retry = () => {
    setIsLoading(true);
    setError(null);
    setRetryCount((count) => count + 1);
  };

  return (
    <main className="reading-summary">
      <ReadingSummarySidebar
        childName={overview?.childName ?? ""}
        history={history}
        onBack={() => navigate("/guardian")}
      />
      <section className="reading-summary__main">
        <header className="reading-summary__header">
          <div><h1>전체 독서 요약</h1><p>{overview?.childName || "아동"}의 독서 활동을 한눈에 확인해보세요.</p></div>
          <PeriodSelector
            range={range}
            disabled={isLoading}
            onPrevious={() => changeRange(-1)}
            onNext={() => changeRange(1)}
          />
        </header>

        {isLoading && !overview ? (
          <div className="reading-summary__state" role="status">독서 요약을 불러오고 있어요.</div>
        ) : error ? (
          <div className="reading-summary__state" role="alert">
            <p>{error.message}</p>
            {error.isAuth ? (
              <button type="button" onClick={() => navigate("/guardian/login")}>로그인하기</button>
            ) : (
              <button type="button" onClick={retry}>다시 시도</button>
            )}
          </div>
        ) : overview ? (
          <div className={`reading-summary__content${isLoading ? " reading-summary__content--loading" : ""}`} aria-busy={isLoading}>
            {isLoading && <div className="reading-summary__updating" role="status">기간을 변경하고 있어요.</div>}
            <WeeklyScoreChart scores={overview.weeklyScores} />
            <AiAnalysisCard status={overview.summaryStatus} summary={overview.aiSummary} hasReading={overview.totalReadingCount > 0} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
