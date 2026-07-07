import "./readingCompletePage.css";

import readingCompleteDecor from "../../assets/Group 5.svg";
import Logo from "../../components/Logo/logo";

const completionMessage = "\uCC45\uC744 \uB05D\uAE4C\uC9C0 \uC77D\uC5C8\uB124!\n\uB300\uB2E8\uD558\uB2E4!";
const finishLabel = "\uC885\uB8CC\uD558\uAE30";

function ReadingCompletePage() {
  return (
    <main className="reading-complete-page">
      <Logo />

      <img
        src={readingCompleteDecor}
        alt=""
        aria-hidden="true"
        className="reading-complete-page__decor-image"
      />

      <section className="reading-complete-page__content">
        <h1 className="reading-complete-page__message">{completionMessage}</h1>

        <button
          type="button"
          className="reading-complete-page__button"
        >
          {finishLabel}
        </button>
      </section>
    </main>
  );
}

export default ReadingCompletePage;
