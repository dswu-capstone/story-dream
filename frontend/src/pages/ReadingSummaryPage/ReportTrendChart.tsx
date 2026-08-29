type TrendPoint = {
  label: string;
  value: number | null;
};

type Props = {
  title: string;
  points: TrendPoint[];
  min: number;
  max: number;
  ticks: number[];
  formatTick: (value: number) => string;
  emptyMessage: string;
};

const WIDTH = 720;
const HEIGHT = 190;
const LEFT = 58;
const RIGHT = 20;
const TOP = 22;
const BOTTOM = 38;

export default function ReportTrendChart({ title, points, min, max, ticks, formatTick, emptyMessage }: Props) {
  const validPoints = points.filter((point): point is TrendPoint & { value: number } => Number.isFinite(point.value));
  const x = (index: number) => points.length <= 1
    ? (LEFT + WIDTH - RIGHT) / 2
    : LEFT + (index * (WIDTH - LEFT - RIGHT)) / (points.length - 1);
  const y = (value: number) => {
    const safeValue = Math.max(min, Math.min(max, value));
    return TOP + ((max - safeValue) * (HEIGHT - TOP - BOTTOM)) / (max - min);
  };
  const polyline = points
    .map((point, index) => Number.isFinite(point.value) ? `${x(index)},${y(point.value as number)}` : null)
    .filter((point): point is string => point !== null)
    .join(" ");
  const summary = validPoints.length === 0
    ? emptyMessage
    : validPoints.map((point) => `${point.label}: ${formatTick(point.value)}`).join(", ");

  return (
    <section className="reading-summary__detail-chart-card">
      <h2>{title}</h2>
      {validPoints.length === 0 ? (
        <div className="reading-summary__chart-empty">{emptyMessage}</div>
      ) : (
        <svg className="reading-summary__detail-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} className="reading-summary__detail-grid" />
              <text x={LEFT - 10} y={y(tick) + 4} textAnchor="end">{formatTick(tick)}</text>
            </g>
          ))}
          {validPoints.length > 1 && <polyline points={polyline} className="reading-summary__detail-line" />}
          {points.map((point, index) => Number.isFinite(point.value) && (
            <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value as number)} r="4" className="reading-summary__detail-point" />
          ))}
          {points.map((point, index) => (
            <text key={point.label} x={x(index)} y={HEIGHT - 10} textAnchor="middle" className="reading-summary__x-label">{point.label}</text>
          ))}
        </svg>
      )}
      <p className="reading-summary__sr-only">{summary}</p>
    </section>
  );
}
