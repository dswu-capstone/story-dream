import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getReadingReportData, getReadingReportDetail, ReadingReportApiError } from "../../api/readingReport";
import type { ReportDetailResponse, ReportOverviewResponse, ReportSummary } from "../../types/readingReport";
import { getMonthRange, shiftMonth, type DateRange } from "../../utils/reportDate";
import AiAnalysisCard from "./AiAnalysisCard";
import PeriodSelector from "./PeriodSelector";
import ReadingHistoryDetail from "./ReadingHistoryDetail";
import ReadingSummarySidebar from "./ReadingSummarySidebar";
import type { ReportView } from "./ReadingSummarySidebar";
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
  const [activeView, setActiveView] = useState<ReportView>("summary");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReportDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<ErrorState>(null);
  const [detailRetryCount, setDetailRetryCount] = useState(0);
  const detailCache = useRef(new Map<number, ReportDetailResponse>());

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
          setSelectedReportId((current) => data.history.content.some((item) => item.reportId === current)
            ? current
            : data.history.content[0]?.reportId ?? null);
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

  useEffect(() => {
    if (activeView !== "history" || selectedReportId === null) return;
    const cached = detailCache.current.get(selectedReportId);
    if (cached) {
      setDetail(cached);
      setDetailError(null);
      setIsDetailLoading(false);
      return;
    }

    let isActive = true;
    setIsDetailLoading(true);
    setDetailError(null);
    if (!cached) setDetail(null);

    const loadDetail = async () => {
      try {
        const data = await getReadingReportDetail(selectedReportId);
        if (isActive) {
          detailCache.current.set(selectedReportId, data);
          setDetail(data);
        }
      } catch (caught) {
        const apiError = caught instanceof ReadingReportApiError ? caught : null;
        if (isActive) {
          setDetailError({
            message: apiError?.message ?? "상세 리포트를 불러오는 중 오류가 발생했습니다.",
            isAuth: apiError?.status === 401 || apiError?.status === 403,
          });
        }
      } finally {
        if (isActive) setIsDetailLoading(false);
      }
    };
    void loadDetail();
    return () => { isActive = false; };
  }, [activeView, detailRetryCount, selectedReportId]);

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

  const selectHistory = () => {
    setActiveView("history");
    if (history.length > 0 && !history.some((item) => item.reportId === selectedReportId)) {
      setSelectedReportId(history[0].reportId);
    }
  };

  const selectReport = (reportId: number) => {
    setActiveView("history");
    setDetailRetryCount(0);
    setSelectedReportId(reportId);
  };

  const retryDetail = () => {
    if (selectedReportId !== null) detailCache.current.delete(selectedReportId);
    setDetailRetryCount((count) => count + 1);
  };

  return (
    <main className="reading-summary">
      <ReadingSummarySidebar
        childName={overview?.childName ?? ""}
        history={history}
        activeView={activeView}
        selectedReportId={selectedReportId}
        onBack={() => navigate("/guardian")}
        onSelectSummary={() => setActiveView("summary")}
        onSelectHistory={selectHistory}
        onSelectReport={selectReport}
      />
      <section className="reading-summary__main">
        {activeView === "summary" ? <>
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
        </> : history.length === 0 ? (
          <div className="reading-summary__state">
            <h1>독서 이력</h1>
            <p>기간 내 독서 이력이 없어요.</p>
          </div>
        ) : isDetailLoading && !detail ? (
          <div className="reading-summary__state" role="status">상세 리포트를 불러오고 있어요.</div>
        ) : detailError ? (
          <div className="reading-summary__state" role="alert">
            <p>{detailError.message}</p>
            {detailError.isAuth ? (
              <button type="button" onClick={() => navigate("/guardian/login")}>로그인하기</button>
            ) : (
              <button type="button" onClick={retryDetail}>다시 시도</button>
            )}
          </div>
        ) : detail ? (
          <div className={isDetailLoading ? "reading-summary__detail-loading" : undefined} aria-busy={isDetailLoading}>
            <ReadingHistoryDetail detail={detail} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
