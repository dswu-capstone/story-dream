import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import "./storyQuizPage.css";

import { getQuizzes, submitQuiz } from "../../api/quiz";
import optionOneIcon from "../../assets/mdi_number-1-circle-outline.svg";
import optionTwoIcon from "../../assets/mdi_number-2-circle-outline.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import type { Quiz } from "../../types/quiz";
import { loadReadingSession } from "../../utils/readingSession";

type StoryQuizLocationState = {
  startQuizIndex?: number;
};

const optionIcons = [optionOneIcon, optionTwoIcon];

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "퀴즈를 불러오지 못했습니다.";
}

function StoryQuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as StoryQuizLocationState | null;
  const [storedSession] = useState(loadReadingSession);
  const originalStoryId =
    storedSession?.originalStoryId ??
    Number(searchParams.get("originalStoryId") ?? searchParams.get("storyId"));
  const partType =
    storedSession?.currentPart.type ?? searchParams.get("partType") ?? "";
  const startQuizIndex = locationState?.startQuizIndex ?? 0;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const currentQuizIndex = startQuizIndex;
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadQuizzes = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!storedSession) {
          throw new Error("진행 중인 독서 기록을 찾을 수 없습니다.");
        }

        const data = await getQuizzes({ originalStoryId, partType });

        if (data.length === 0) {
          throw new Error("현재 파트에 등록된 퀴즈가 없습니다.");
        }

        setQuizzes(data);
      } catch (error) {
        console.error("퀴즈 목록 조회 오류:", error);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadQuizzes();
  }, [originalStoryId, partType, storedSession]);

  const currentQuiz = quizzes[currentQuizIndex];
  const totalQuizzes = Math.max(quizzes.length, 1);
  const currentStep = Math.min(currentQuizIndex + 1, totalQuizzes);
  const isOxQuiz = currentQuiz?.type === "OX";

  const handleSubmit = async () => {
    if (!currentQuiz || !selectedAnswer || !storedSession || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const quizResult = await submitQuiz({
        quizId: currentQuiz.quizId,
        readingHistoryId: storedSession.readingHistoryId,
        selectedAnswer,
      });

      navigate("/stories/result", {
        state: {
          readingHistoryId: storedSession.readingHistoryId,
          originalStoryId: storedSession.originalStoryId,
          storyTitle: storedSession.storyTitle,
          selectedLevel: storedSession.selectedLevel,
          partType,
          partOrderNum: storedSession.currentPart.orderNum,
          quizIndex: currentQuizIndex,
          totalQuizzes: quizzes.length,
          selectedAnswer,
          isCorrect: quizResult.isCorrect,
          correctAnswer: quizResult.correctAnswer,
          explanation: currentQuiz.explanation?.trim() ?? "",
          lastQuizOfPart: quizResult.lastQuizOfPart,
          recommendedLevel: quizResult.recommendedLevel,
        },
      });
    } catch (error) {
      console.error("퀴즈 제출 오류:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="story-quiz-page">
      <Logo />

      <div className="story-quiz-page__progress">
        <StoryProgressBar currentStep={currentStep} totalSteps={totalQuizzes} />
      </div>

      {isLoading && <p className="story-quiz-page__status">퀴즈를 불러오는 중...</p>}

      {!isLoading && errorMessage && !currentQuiz && (
        <p className="story-quiz-page__status" role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && currentQuiz && (
        <>
          <div className="story-quiz-page__counter">
            {currentQuizIndex + 1} / {quizzes.length}
          </div>

          <section className="story-quiz-page__content">
            <h1 className="story-quiz-page__question">{currentQuiz.question}</h1>

            <div
              className={
                isOxQuiz
                  ? "story-quiz-page__choices story-quiz-page__choices--ox"
                  : "story-quiz-page__choices"
              }
            >
              {currentQuiz.choices.map((choice, index) => {
                const isSelected = selectedAnswer === choice;

                if (isOxQuiz) {
                  return (
                    <button
                      key={choice}
                      type="button"
                      className={
                        isSelected
                          ? "story-quiz-page__ox-button story-quiz-page__ox-button--selected"
                          : "story-quiz-page__ox-button"
                      }
                      onClick={() => setSelectedAnswer(choice)}
                      disabled={isSubmitting}
                    >
                      {choice}
                    </button>
                  );
                }

                return (
                  <button
                    key={choice}
                    type="button"
                    className={
                      isSelected
                        ? "story-quiz-page__choice story-quiz-page__choice--selected"
                        : "story-quiz-page__choice"
                    }
                    onClick={() => setSelectedAnswer(choice)}
                    disabled={isSubmitting}
                  >
                    <img
                      src={optionIcons[index] ?? optionIcons[0]}
                      alt=""
                      aria-hidden="true"
                      className="story-quiz-page__choice-icon"
                    />
                    <span className="story-quiz-page__choice-label">{choice}</span>
                  </button>
                );
              })}
            </div>

            {errorMessage && (
              <p className="story-quiz-page__submit-error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              className="story-quiz-page__submit-button"
              onClick={handleSubmit}
              disabled={!selectedAnswer || isSubmitting}
            >
              {isSubmitting ? "제출 중..." : "제출하기"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

export default StoryQuizPage;
