import type { WeeklyScore } from "../../types/readingReport";

type Props = { scores: WeeklyScore[] };
const WIDTH = 720;
const HEIGHT = 170;
const LEFT = 48;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 38;

export default function WeeklyScoreChart({ scores }: Props) {
  const validValues = scores.flatMap((score) =>
    score.averageQuizScore === null ? [] : [score.averageQuizScore],
  );
  const summary = scores.length === 0
    ? "주차별 정답률 데이터가 없습니다."
    : scores.map((score) => `${score.label}: ${score.averageQuizScore === null ? "데이터 없음" : `${Math.round(score.averageQuizScore)}%`}`).join(", ");
  const x = (index: number) => scores.length <= 1
    ? (LEFT + WIDTH - RIGHT) / 2
    : LEFT + (index * (WIDTH - LEFT - RIGHT)) / (scores.length - 1);
  const y = (value: number) => TOP + ((100 - Math.max(0, Math.min(100, value))) * (HEIGHT - TOP - BOTTOM)) / 100;

  const segments: string[] = [];
  let current = "";
  scores.forEach((score, index) => {
    if (score.averageQuizScore === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    const point = `${x(index)},${y(score.averageQuizScore)}`;
    current = current ? `${current} ${point}` : point;
  });
  if (current) segments.push(current);

  return (
    <section className="reading-summary__chart-card">
      <h2>평균 정답률</h2>
      {validValues.length === 0 ? (
        <div className="reading-summary__chart-empty">이 기간에는 주차별 정답률 데이터가 없어요.</div>
      ) : (
        <svg className="reading-summary__chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary}>
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} className="reading-summary__grid" />
              <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end">{tick}%</text>
            </g>
          ))}
          {segments.map((points, index) => (
            points.includes(" ") && <polyline key={index} points={points} className="reading-summary__line" />
          ))}
          {scores.map((score, index) => score.averageQuizScore !== null && (
            <circle key={score.weekStart} cx={x(index)} cy={y(score.averageQuizScore)} r="4" className="reading-summary__point" />
          ))}
          {scores.map((score, index) => (
            <text key={score.weekStart} x={x(index)} y={HEIGHT - 10} textAnchor="middle" className="reading-summary__x-label">{score.label}</text>
          ))}
        </svg>
      )}
      <p className="reading-summary__sr-only">{summary}</p>
    </section>
  );
}
