import "./storyProgressBar.css";

import flagIcon from "../../assets/si_flag-duotone.svg";

type StoryProgressBarProps = {
  currentStep: number;
  totalSteps: number;
};

function StoryProgressBar({
  currentStep,
  totalSteps,
}: StoryProgressBarProps) {
  const safeTotal = Math.max(totalSteps, 1);
  const safeCurrent = Math.min(Math.max(currentStep, 0), safeTotal);
  const progressRatio = safeCurrent / safeTotal;

  return (
    <div
      className="story-progress-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeCurrent}
    >
      <div className="story-progress-bar__track">
        <div
          className="story-progress-bar__fill"
          style={{ width: `${progressRatio * 100}%` }}
        />
        <img
          src={flagIcon}
          alt=""
          aria-hidden="true"
          className="story-progress-bar__flag"
          style={{ left: `${progressRatio * 100}%` }}
        />
      </div>
    </div>
  );
}

export default StoryProgressBar;
