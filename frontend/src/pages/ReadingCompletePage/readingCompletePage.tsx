import "./readingCompletePage.css";

import readingCompleteDecor from "../../assets/Group 5.svg";
import Logo from "../../components/Logo/logo";

const completionMessage = "책을 끝까지 읽었네!\n대단하다!";
const finishLabel = "종료하기";

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
