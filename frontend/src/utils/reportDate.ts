export type DateRange = {
  from: string;
  to: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getMonthRange(date = new Date()): DateRange {
  return {
    from: formatLocalDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: formatLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export function shiftMonth(range: DateRange, offset: number): DateRange {
  const [year, month] = range.from.split("-").map(Number);
  return getMonthRange(new Date(year, month - 1 + offset, 1));
}

export function formatRangeLabel(range: DateRange): string {
  return `${range.from.replaceAll("-", ".")} ~ ${range.to.replaceAll("-", ".")}`;
}
