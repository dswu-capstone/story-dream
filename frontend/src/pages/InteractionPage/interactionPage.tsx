import "./interactionPage.css";

import { useParams } from "react-router-dom";

import interactionCharacter from "../../assets/interaction_character.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";

const levelAdjustContent = {
  easier: {
    question: "조금 더 쉬운 글로 읽어볼까?",
    decline: "아니요,\n이대로 할래요",
    accept: "네,\n좋아요",
  },
  harder: {
    question: "조금 더 어려운 글로 읽어볼까?",
    decline: "아니요,\n이대로 할래요",
    accept: "네,\n좋아요",
  },
} as const;

function InteractionPage() {
  const { variant } = useParams<{ variant?: string }>();
  const currentStep = 1;
  const totalSteps = 4;
  const content =
    variant === "harder"
      ? levelAdjustContent.harder
      : levelAdjustContent.easier;

  return (
    <main className="interaction-page">
      <Logo />

      <div className="interaction-page__progress">
        <StoryProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      </div>

      <section className="interaction-page__panel">
        <div className="interaction-page__content">
          <h1 className="interaction-page__title">{content.question}</h1>

          <div className="interaction-page__actions">
            <button
              type="button"
              className="interaction-page__button interaction-page__button--decline"
            >
              {content.decline}
            </button>

            <button
              type="button"
              className="interaction-page__button interaction-page__button--accept"
            >
              {content.accept}
            </button>
          </div>
        </div>

        <img
          src={interactionCharacter}
          alt=""
          aria-hidden="true"
          className="interaction-page__character"
        />
      </section>
    </main>
  );
}

export default InteractionPage;
