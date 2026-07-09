import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import "./storyQuizPage.css";

import { getMockQuizzes, getQuizzes, submitQuiz } from "../../api/quiz";
import optionOneIcon from "../../assets/mdi_number-1-circle-outline.svg";
import optionTwoIcon from "../../assets/mdi_number-2-circle-outline.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import type { Quiz } from "../../types/quiz";

const submitLabel = "제출하기";
const optionIcons = [optionOneIcon, optionTwoIcon];

function StoryQuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storyId = Number(searchParams.get("storyId") ?? 1);
  const level = Number(searchParams.get("level") ?? 1);
  const partIndex = Number(searchParams.get("partIndex") ?? 0);
  const totalParts = Number(searchParams.get("totalParts") ?? 1);
  const partType = searchParams.get("partType") ?? "서론";
  const startQuizIndex = (
    location.state as { startQuizIndex?: number } | null
  )?.startQuizIndex;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadQuizzes = async () => {
      setIsLoading(true);

      try {
        const data = await getQuizzes({
          originalStoryId: storyId,
          partType,
        });

        if (data.length === 0) {
          setQuizzes(getMockQuizzes(partType));
        } else {
          setQuizzes(data);
        }
      } catch (error) {
        console.error("퀴즈 목록 조회 오류:", error);
        setQuizzes(getMockQuizzes(partType));
      } finally {
        setIsLoading(false);
      }
    };

    void loadQuizzes();
  }, [partType, storyId]);

  useEffect(() => {
    setCurrentQuizIndex(startQuizIndex ?? 0);
    setSelectedAnswer("");
  }, [partType, startQuizIndex]);

  useEffect(() => {
    setSelectedAnswer("");
  }, [currentQuizIndex]);

  const currentQuiz = quizzes[currentQuizIndex];
  const totalQuizzes = Math.max(quizzes.length, 1);
  const currentStep = Math.min(currentQuizIndex + 1, totalQuizzes);
  const isOxQuiz = currentQuiz?.type === "OX";

  const handleSubmit = async () => {
    if (!currentQuiz || !selectedAnswer) {
      return;
    }

    let quizResult = {
      isCorrect: selectedAnswer === currentQuiz.correctAnswer,
      correctAnswer: currentQuiz.correctAnswer ?? selectedAnswer,
    };

    try {
      quizResult = await submitQuiz(
        currentQuiz.quizId,
        selectedAnswer,
        currentQuiz.correctAnswer,
      );
    } catch (error) {
      console.error("퀴즈 제출 오류:", error);
    }

    navigate("/stories/result", {
      state: {
        storyId,
        level,
        partIndex,
        totalParts,
        partType,
        quizIndex: currentQuizIndex,
        totalQuizzes: quizzes.length,
        selectedAnswer,
        isCorrect: quizResult.isCorrect,
        correctAnswer: quizResult.correctAnswer,
        explanation:
          currentQuiz.explanation ??
          `정답은 ${quizResult.correctAnswer}예요.`,
      },
    });
  };

  return (
    <main className="story-quiz-page">
      <Logo />

      <div className="story-quiz-page__progress">
        <StoryProgressBar currentStep={currentStep} totalSteps={totalQuizzes} />
      </div>

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

            <button
              type="button"
              className="story-quiz-page__submit-button"
              onClick={handleSubmit}
              disabled={!selectedAnswer}
            >
              {submitLabel}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

export default StoryQuizPage;
