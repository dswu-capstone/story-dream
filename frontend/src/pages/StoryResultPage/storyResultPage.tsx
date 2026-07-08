import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./storyResultPage.css";

import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";

type StoryResultState = {
  storyId: number;
  level: number;
  partIndex: number;
  totalParts: number;
  partType: string;
  quizIndex: number;
  totalQuizzes: number;
  selectedAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
};

const nextLabel = "다음";

function StoryResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const resultState = location.state as StoryResultState | null;

  useEffect(() => {
    if (!resultState) {
      navigate("/stories/quiz", { replace: true });
    }
  }, [navigate, resultState]);

  if (!resultState) {
    return null;
  }

  const {
    storyId,
    level,
    partIndex,
    totalParts,
    partType,
    quizIndex,
    totalQuizzes,
    isCorrect,
    correctAnswer,
    explanation,
  } = resultState;

  const titleMessage = isCorrect
    ? "잘했어! 정답이야"
    : "그렇게 생각할 수도 있겠다!";

  const description = isCorrect
    ? explanation
    : `${explanation} 정답은 ${correctAnswer}야.`;

  const handleNext = () => {
    if (quizIndex < totalQuizzes - 1) {
      const quizParams = new URLSearchParams({
        storyId: String(storyId),
        level: String(level),
        partIndex: String(partIndex),
        totalParts: String(totalParts),
        partType,
      });

      navigate(`/stories/quiz?${quizParams.toString()}`, {
        state: {
          startQuizIndex: quizIndex + 1,
        },
      });
      return;
    }

    if (partIndex >= totalParts - 1) {
      navigate("/stories/complete");
      return;
    }

    navigate(
      `/stories/read?storyId=${storyId}&level=${level}&partIndex=${partIndex + 1}`,
    );
  };

  return (
    <main className="story-result-page">
      <Logo />

      <div className="story-result-page__progress">
        <StoryProgressBar
          currentStep={quizIndex + 1}
          totalSteps={Math.max(totalQuizzes, 1)}
        />
      </div>

      <div className="story-result-page__counter">
        {quizIndex + 1} / {totalQuizzes}
      </div>

      <section className="story-result-page__panel">
        <div className="story-result-page__content">
          <h1 className="story-result-page__title">{titleMessage}</h1>
          <p className="story-result-page__description">{description}</p>
        </div>

        <button
          type="button"
          className="story-result-page__button"
          onClick={handleNext}
        >
          {nextLabel}
        </button>
      </section>
    </main>
  );
}

export default StoryResultPage;
