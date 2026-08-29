import "./interactionPage.css";

import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import interactionCharacter from "../../assets/interaction_character.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import {
  getReadingPageProgress,
  loadReadingSession,
} from "../../utils/readingSession";

type LevelAdjustState = {
  originalStoryId: number;
  storyTitle: string;
  selectedLevel: number;
  recommendedLevel: number;
};

const levelAdjustContent = {
  easier: {
    question: "조금 더 쉬운 글로 읽어볼까?",
    decline: "아니요\n이대로 할래요",
    accept: "네\n좋아요",
  },
  harder: {
    question: "조금 더 어려운 글로 읽어볼까?",
    decline: "아니요\n이대로 할래요",
    accept: "네\n좋아요",
  },
} as const;

function InteractionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { variant } = useParams<{ variant?: string }>();
  const adjustState = location.state as LevelAdjustState | null;
  const readingSession = loadReadingSession();
  const content =
    variant === "harder"
      ? levelAdjustContent.harder
      : levelAdjustContent.easier;
  const pageProgress = readingSession
    ? getReadingPageProgress(readingSession)
    : { currentPage: 1, totalPages: 1 };

  useEffect(() => {
    if (!adjustState || !readingSession) {
      navigate("/stories/recommend", { replace: true });
    }
  }, [adjustState, navigate, readingSession]);

  if (!adjustState || !readingSession) {
    return null;
  }

  const continueReading = (selectedLevel: number) => {
    navigate(`/stories/read?originalStoryId=${adjustState.originalStoryId}`, {
      state: {
        advanceToNextPart: true,
        selectedLevel,
        storyTitle: adjustState.storyTitle,
      },
    });
  };

  return (
    <main className="interaction-page">
      <Logo />

      <div className="interaction-page__progress">
        <StoryProgressBar
          currentStep={pageProgress.currentPage}
          totalSteps={pageProgress.totalPages}
        />
      </div>

      <section className="interaction-page__panel">
        <div className="interaction-page__content">
          <h1 className="interaction-page__title">{content.question}</h1>

          <div className="interaction-page__actions">
            <button
              type="button"
              className="interaction-page__button interaction-page__button--decline"
              onClick={() => continueReading(adjustState.selectedLevel)}
            >
              {content.decline}
            </button>

            <button
              type="button"
              className="interaction-page__button interaction-page__button--accept"
              onClick={() => continueReading(adjustState.recommendedLevel)}
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
