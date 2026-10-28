import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "./storyResultPage.css";

import { sendLedQuiz } from "../../api/led";
import { endReading } from "../../api/reading";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import {
  clearReadingSession,
  getReadingPageProgress,
  loadReadingSession,
} from "../../utils/readingSession";

import type { ReadingQuizResult } from "../../types/story";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "다음 단계로 이동하지 못했습니다.";
}

function StoryResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const resultState = location.state as ReadingQuizResult | null;
  const readingSession = loadReadingSession();
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!resultState) {
      navigate("/stories/quiz", { replace: true });
    }
  }, [navigate, resultState]);

  // 퀴즈 결과를 LED 로: 정답이면 초록 60개, 오답이면 빨강 60개.
  useEffect(() => {
    if (resultState) {
      sendLedQuiz(resultState.isCorrect);
    }
  }, [resultState]);

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
        fromPartOrderNum: partOrderNum,
        selectedLevel: nextLevel,
        storyTitle,
      },
    });
  };

  const handleNext = async () => {
    if (pendingRef.current) {
      return;
    }

    if (!readingSession || readingSession.readingHistoryId !== readingHistoryId) {
      navigate("/stories/recommend", { replace: true });
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
      pendingRef.current = true;
      setIsPending(true);

      try {
        await endReading(readingHistoryId);
        clearReadingSession();
        navigate("/stories/complete", { replace: true });
      } catch (error) {
        console.error("동화 읽기 종료 오류:", error);
        setErrorMessage(getErrorMessage(error));
      } finally {
        pendingRef.current = false;
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
          fromPartOrderNum: partOrderNum,
          readingHistoryId,
        },
      });
      return;
    }

    moveToNextPart(selectedLevel);
  };

  return (
    <main className="story-result-page">
      <Logo />

      <div className="story-progress-footer">
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
