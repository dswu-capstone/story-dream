import type { DateRange } from "../../utils/reportDate";
import { formatRangeLabel } from "../../utils/reportDate";

type Props = {
  range: DateRange;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export default function PeriodSelector({ range, disabled, onPrevious, onNext }: Props) {
  return (
    <div className="reading-summary__period" aria-label="조회 기간 선택">
      <button type="button" onClick={onPrevious} disabled={disabled} aria-label="이전 달">‹</button>
      <span>{formatRangeLabel(range)}</span>
      <button type="button" onClick={onNext} disabled={disabled} aria-label="다음 달">›</button>
    </div>
  );
}
