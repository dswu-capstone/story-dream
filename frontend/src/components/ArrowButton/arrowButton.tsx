import "./arrowButton.css";

import leftArrowIcon from "../../assets/left.svg";
import rightArrowIcon from "../../assets/right.svg";

type ArrowButtonProps = {
  direction: "left" | "right";
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
};

function ArrowButton({
  direction,
  onClick,
  disabled = false,
  ariaLabel,
}: ArrowButtonProps) {
  const arrowIcon = direction === "left" ? leftArrowIcon : rightArrowIcon;

  return (
    <button
      type="button"
      className="arrow-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <img src={arrowIcon} alt="" aria-hidden="true" className="arrow-button__icon" />
    </button>
  );
}

export default ArrowButton;
