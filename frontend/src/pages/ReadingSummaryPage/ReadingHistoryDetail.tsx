import type { PartTrend, ReportDetailResponse } from "../../types/readingReport";
import ReportTrendChart from "./ReportTrendChart";

type Props = { detail: ReportDetailResponse };

const PART_LABELS = ["서론", "본론", "결론"];

function formatCompletedDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "날짜 정보 없음";
}

function getOrderedParts(parts: PartTrend[]) {
  const byOrder = new Map(parts.map((part) => [part.orderNum, part]));
  return PART_LABELS.map((label, index) => ({ label, part: byOrder.get(index + 1) ?? null }));
}

export default function ReadingHistoryDetail({ detail }: Props) {
  const parts = getOrderedParts(detail.parts);

  return (
    <>
      <header className="reading-summary__header reading-summary__detail-header">
        <div>
          <h1>{detail.storyTitle} 리포트</h1>
          <p>{detail.childName || "아동"}의 독서 활동을 한눈에 확인해보세요.</p>
        </div>
        <div className="reading-summary__completed-date">완료 날짜: {formatCompletedDate(detail.completedDate)}</div>
      </header>
      <div className="reading-summary__detail-content">
        <ReportTrendChart
          title="평균 정답률"
          points={parts.map(({ label, part }) => ({ label, value: part?.accuracy ?? null }))}
          min={0}
          max={100}
          ticks={[0, 30, 50, 70, 100]}
          formatTick={(value) => `${value}%`}
          emptyMessage="구간별 정답률 데이터가 없어요."
        />
        <ReportTrendChart
          title="난이도 변화"
          points={parts.map(({ label, part }) => ({ label, value: part?.level ?? null }))}
          min={1}
          max={3}
          ticks={[1, 2, 3]}
          formatTick={(value) => `레벨 ${value}`}
          emptyMessage="구간별 난이도 데이터가 없어요."
        />
      </div>
    </>
  );
}
