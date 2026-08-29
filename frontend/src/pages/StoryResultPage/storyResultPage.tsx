import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./storyResultPage.css";

import { endReading } from "../../api/reading";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import {
  clearReadingSession,
  getReadingPageProgress,
  loadReadingSession,
} from "../../utils/readingSession";

type StoryResultState = {
  readingHistoryId: number;
  originalStoryId: number;
  storyTitle: string;
  selectedLevel: number;
  partType: string;
  partOrderNum: number;
  quizIndex: number;
  totalQuizzes: number;
  selectedAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  lastQuizOfPart: boolean;
  recommendedLevel: number | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "다음 단계로 이동하지 못했습니다.";
}

function StoryResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const resultState = location.state as StoryResultState | null;
  const readingSession = loadReadingSession();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!resultState) {
      navigate("/stories/quiz", { replace: true });
    }
  }, [navigate, resultState]);

  if (!resultState) {
    return null;
  }

  const {
    readingHistoryId,
    originalStoryId,
    storyTitle,
    selectedLevel,
    partType,
    partOrderNum,
    quizIndex,
    totalQuizzes,
    isCorrect,
    correctAnswer,
    explanation,
    lastQuizOfPart,
    recommendedLevel,
  } = resultState;

  const titleMessage = isCorrect
    ? "잘했어! 정답이야"
    : "그렇게 생각할 수도 있겠구나!";

  const answerMessage = `정답은 ${correctAnswer}이야.`;
  const description = isCorrect
    ? explanation || answerMessage
    : [explanation, answerMessage].filter(Boolean).join(" ");
  const pageProgress = readingSession
    ? getReadingPageProgress(readingSession)
    : { currentPage: 1, totalPages: 1 };

  const moveToNextPart = (nextLevel: number) => {
    navigate(`/stories/read?originalStoryId=${originalStoryId}`, {
      state: {
        advanceToNextPart: true,
        selectedLevel: nextLevel,
        storyTitle,
      },
    });
  };

  const handleNext = async () => {
    if (isPending) {
      return;
    }

    setErrorMessage("");

    if (!lastQuizOfPart) {
      if (quizIndex >= totalQuizzes - 1) {
        setErrorMessage("다음 퀴즈 정보를 찾을 수 없습니다.");
        return;
      }

      const quizParams = new URLSearchParams({
        originalStoryId: String(originalStoryId),
        partType,
      });

      navigate(`/stories/quiz?${quizParams.toString()}`, {
        state: { startQuizIndex: quizIndex + 1 },
      });
      return;
    }

    if (partOrderNum >= 3) {
      setIsPending(true);

      try {
        await endReading(readingHistoryId);
        clearReadingSession();
        navigate("/stories/complete", { replace: true });
      } catch (error) {
        console.error("동화 읽기 종료 오류:", error);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsPending(false);
      }

      return;
    }

    if (
      recommendedLevel !== null &&
      recommendedLevel !== selectedLevel
    ) {
      const variant = recommendedLevel > selectedLevel ? "harder" : "easier";

      navigate(`/children/level-adjust/${variant}`, {
        state: {
          originalStoryId,
          storyTitle,
          selectedLevel,
          recommendedLevel,
        },
      });
      return;
    }

    moveToNextPart(selectedLevel);
  };

  return (
    <main className="story-result-page">
      <Logo />

      <div className="story-result-page__progress">
        <StoryProgressBar
          currentStep={pageProgress.currentPage}
          totalSteps={pageProgress.totalPages}
        />
      </div>

      <div className="story-result-page__counter">
        {quizIndex + 1} / {totalQuizzes}
      </div>

      <section className="story-result-page__panel">
        <div className="story-result-page__content">
          <h1 className="story-result-page__title">{titleMessage}</h1>
          <p className="story-result-page__description">{description}</p>
          {errorMessage && (
            <p className="story-result-page__error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <button
          type="button"
          className="story-result-page__button"
          onClick={handleNext}
          disabled={isPending}
        >
          {isPending ? "처리 중..." : "다음"}
        </button>
      </section>
    </main>
  );
}

export default StoryResultPage;
