type Props = {
  playing: boolean;
  previousDisabled: boolean;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
};

function PlayerIcon({ kind }: { kind: "previous" | "next" | "pause" | "play" }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="currentColor">
      {kind === "pause" ? <path d="M7 4h6v24H7zM19 4h6v24h-6z" /> :
        kind === "previous" ? <path d="M5 5h2v22H5zM26 4v24L9 16z" /> :
          kind === "next" ? <path d="M25 5h2v22h-2zM6 4l17 12L6 28z" /> :
            <path d="M8 3l21 13L8 29z" />}
    </svg>
  );
}

export default function StoryPlayerControls({ playing, previousDisabled, onPrevious, onToggle, onNext }: Props) {
  return (
    <div className="story-reading-page__actions" role="group" aria-label="동화 재생 조작">
      <button type="button" className="story-reading-page__control" onClick={onPrevious} disabled={previousDisabled}>
        <span className="story-reading-page__control-circle"><PlayerIcon kind="previous" /></span>
        <span>이전</span>
      </button>
      <button type="button" className="story-reading-page__control story-reading-page__control--primary" onClick={onToggle}>
        <span className="story-reading-page__control-circle"><PlayerIcon kind={playing ? "pause" : "play"} /></span>
        <span>{playing ? "일시정지" : "재생"}</span>
      </button>
      <button type="button" className="story-reading-page__control" onClick={onNext}>
        <span className="story-reading-page__control-circle"><PlayerIcon kind="next" /></span>
        <span>다음</span>
      </button>
    </div>
  );
}
