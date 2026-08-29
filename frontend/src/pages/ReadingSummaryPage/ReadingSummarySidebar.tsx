import childProfile from "../../assets/child_profile.svg";
import bookIcon from "../../assets/book.svg";
import type { ReportSummary } from "../../types/readingReport";

export type ReportView = "summary" | "history";

type Props = {
  childName: string;
  history: ReportSummary[];
  activeView: ReportView;
  selectedReportId: number | null;
  onBack: () => void;
  onSelectSummary: () => void;
  onSelectHistory: () => void;
  onSelectReport: (reportId: number) => void;
};

export default function ReadingSummarySidebar({
  childName,
  history,
  activeView,
  selectedReportId,
  onBack,
  onSelectSummary,
  onSelectHistory,
  onSelectReport,
}: Props) {
  return (
    <aside className="reading-summary__sidebar">
      <button type="button" className="reading-summary__back" onClick={onBack} aria-label="이전 화면으로">‹</button>
      <img className="reading-summary__profile" src={childProfile} alt="" />
      <strong className="reading-summary__child-name">{childName || "아동"}</strong>
      <nav aria-label="독서 보고서 메뉴">
        <button type="button" className={`reading-summary__menu${activeView === "summary" ? " reading-summary__menu--active" : ""}`} aria-current={activeView === "summary" ? "page" : undefined} onClick={onSelectSummary}>전체 요약</button>
        <button type="button" className={`reading-summary__menu${activeView === "history" ? " reading-summary__menu--active" : ""}`} aria-current={activeView === "history" ? "page" : undefined} onClick={onSelectHistory}>독서 이력</button>
      </nav>
      <div className="reading-summary__history" aria-label="기간 내 독서 이력">
        {history.length === 0 ? <p>기간 내 독서 이력이 없어요.</p> : history.map((item) => (
          <button
            type="button"
            key={item.reportId}
            className={`reading-summary__history-item${activeView === "history" && selectedReportId === item.reportId ? " reading-summary__history-item--selected" : ""}`}
            aria-pressed={activeView === "history" && selectedReportId === item.reportId}
            onClick={() => onSelectReport(item.reportId)}
          >
            <img src={bookIcon} alt="" aria-hidden="true" />
            <span>{item.storyTitle}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
