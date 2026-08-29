import childProfile from "../../assets/child_profile.svg";
import bookIcon from "../../assets/book.svg";
import type { ReportSummary } from "../../types/readingReport";

type Props = { childName: string; history: ReportSummary[]; onBack: () => void };

export default function ReadingSummarySidebar({ childName, history, onBack }: Props) {
  return (
    <aside className="reading-summary__sidebar">
      <button type="button" className="reading-summary__back" onClick={onBack} aria-label="이전 화면으로">‹</button>
      <img className="reading-summary__profile" src={childProfile} alt="" />
      <strong className="reading-summary__child-name">{childName || "아동"}</strong>
      <nav aria-label="독서 보고서 메뉴">
        <span className="reading-summary__menu reading-summary__menu--active" aria-current="page">전체 요약</span>
        <span className="reading-summary__menu">독서 이력</span>
      </nav>
      <div className="reading-summary__history" aria-label="기간 내 독서 이력">
        {history.length === 0 ? <p>기간 내 독서 이력이 없어요.</p> : history.map((item) => (
          <div key={item.reportId} className="reading-summary__history-item">
            <img src={bookIcon} alt="" aria-hidden="true" />
            <span>{item.storyTitle}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
