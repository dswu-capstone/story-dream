import aiStar from "../../assets/ai_star.svg";

type Props = { status: string; summary: string | null; hasReading: boolean };

export default function AiAnalysisCard({ status, summary, hasReading }: Props) {
  const normalized = status.toUpperCase();
  let message = summary ?? "AI 종합 분석 결과가 아직 없습니다.";
  if (normalized === "PENDING" || normalized === "PROCESSING") message = "AI 종합 분석을 생성하고 있어요. 잠시 후 다시 확인해 주세요.";
  if (normalized === "FAILED") message = "AI 종합 분석을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  if (!hasReading && summary) message = summary;

  return (
    <section className="reading-summary__ai-card" aria-live="polite">
      <h2>AI 종합 분석</h2>
      <div className="reading-summary__ai-content">
        <img src={aiStar} alt="" />
        <p>{message}</p>
      </div>
    </section>
  );
}
