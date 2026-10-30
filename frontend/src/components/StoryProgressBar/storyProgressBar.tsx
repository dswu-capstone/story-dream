import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import "./storyProgressBar.css";

type StoryProgressBarProps = {
  currentStep: number;
  totalSteps: number;
  maxAccessibleStep?: number;
  onSeek?: (page: number) => void;
  onSeekStart?: () => void;
};

export default function StoryProgressBar({ currentStep, totalSteps, maxAccessibleStep = totalSteps, onSeek, onSeekStart }: StoryProgressBarProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const pointer = useRef<number | null>(null);
  const total = Math.max(totalSteps, 1);
  const clamp = (value: number) => Math.max(1, Math.min(value, total, maxAccessibleStep));
  const current = Math.max(1, Math.min(currentStep, total));
  const shown = draft ?? current;
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return clamp(Math.round((event.clientX - bounds.left) / bounds.width * total));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const values: Record<string, number> = {
      ArrowLeft: current - 1, ArrowDown: current - 1,
      ArrowRight: current + 1, ArrowUp: current + 1,
      Home: 1, End: maxAccessibleStep, PageUp: current + 5, PageDown: current - 5,
    };
    if (values[event.key] === undefined) return;
    event.preventDefault();
    onSeek(clamp(values[event.key]));
  };
  return (
    <div className={onSeek ? "story-progress-bar story-progress-bar--interactive" : "story-progress-bar"}
      role={onSeek ? "slider" : "progressbar"}
      tabIndex={onSeek ? 0 : undefined}
      aria-label="전체 동화 읽기 진행률"
      aria-valuemin={1} aria-valuemax={total} aria-valuenow={shown}
      aria-valuetext={`전체 ${total}페이지 중 ${shown}페이지`}
      onKeyDown={onKeyDown}
      onPointerDown={onSeek ? (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = event.pointerId;
        onSeekStart?.();
        setDraft(fromPointer(event));
      } : undefined}
      onPointerMove={(event) => { if (pointer.current === event.pointerId) setDraft(fromPointer(event)); }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        pointer.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDraft(null);
        onSeek?.(fromPointer(event));
      }}
      onPointerCancel={() => { if (pointer.current !== null) { pointer.current = null; setDraft(null); onSeek?.(current); } }}
      onLostPointerCapture={() => { if (pointer.current !== null) { pointer.current = null; setDraft(null); onSeek?.(current); } }}
    >
      <div className="story-progress-bar__track">
        <div className="story-progress-bar__fill" style={{ width: `${shown / total * 100}%` }} />
        <span className="story-progress-bar__handle" style={{ left: `${shown / total * 100}%` }} />
      </div>
    </div>
  );
}
