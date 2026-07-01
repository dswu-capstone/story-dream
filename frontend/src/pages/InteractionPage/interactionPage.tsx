import "./interactionPage.css";

import interactionCharacter from "../../assets/interaction_character.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";

const questionText =
  "\uC870\uAE08 \uB354 \uC5B4\uB824\uC6B4 \uAE00\uB85C \uC77D\uC5B4\uBCFC\uAE4C?";
const declineText =
  "\uC544\uB2C8\uC694,\n\uC774\uB300\uB85C \uD560\uB798\uC694";
const acceptText = "\uB124,\n\uC88B\uC544\uC694";

function InteractionPage() {
  const currentStep = 1;
  const totalSteps = 4;

  return (
    <main className="interaction-page">
      <Logo />

      <div className="interaction-page__progress">
        <StoryProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      </div>

      <section className="interaction-page__panel">
        <div className="interaction-page__content">
          <h1 className="interaction-page__title">{questionText}</h1>

          <div className="interaction-page__actions">
            <button
              type="button"
              className="interaction-page__button interaction-page__button--decline"
            >
              {declineText}
            </button>

            <button
              type="button"
              className="interaction-page__button interaction-page__button--accept"
            >
              {acceptText}
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
