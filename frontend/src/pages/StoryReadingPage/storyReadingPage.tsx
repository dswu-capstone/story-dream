import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import "./storyReadingPage.css";

import { getNextReadingPart, startReading } from "../../api/reading";
import readingPlaceholder from "../../assets/reading_book.svg";
import replayIcon from "../../assets/mingcute_voice-line.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import type { ReadingSession } from "../../types/story";
import {
  loadReadingSession,
  saveReadingSession,
} from "../../utils/readingSession";

type StoryReadingLocationState = {
  startNewSession?: boolean;
  advanceToNextPart?: boolean;
  childId?: number;
  storyTitle?: string;
  selectedLevel?: number;
};

const TOTAL_PARTS = 3;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "동화 내용을 불러오지 못했습니다.";
}

function StoryReadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as StoryReadingLocationState | null;
  const originalStoryId = Number(
    searchParams.get("originalStoryId") ?? searchParams.get("storyId"),
  );
  const storedChildId = Number(localStorage.getItem("selectedChildId"));
  const childId = locationState?.childId ?? storedChildId;
  const storyTitle = locationState?.storyTitle ?? "동화 읽기";
  const shouldStartNewSession = locationState?.startNewSession === true;
  const shouldAdvancePart = locationState?.advanceToNextPart === true;
  const requestedLevel = locationState?.selectedLevel;

  const initializationStarted = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const [readingSession, setReadingSession] = useState<ReadingSession | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (initializationStarted.current) {
      return;
    }

    initializationStarted.current = true;

    const initializeReading = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (!Number.isInteger(originalStoryId) || originalStoryId <= 0) {
          throw new Error("읽을 동화 정보가 없습니다.");
        }

        const storedSession = loadReadingSession();

        if (shouldAdvancePart) {
          if (
            !storedSession ||
            storedSession.originalStoryId !== originalStoryId
          ) {
            throw new Error("진행 중인 독서 기록을 찾을 수 없습니다.");
          }

          const nextPart = await getNextReadingPart(
            storedSession.readingHistoryId,
            requestedLevel ?? storedSession.selectedLevel,
          );
          const nextSession: ReadingSession = {
            ...storedSession,
            selectedLevel: nextPart.level,
            currentPart: {
              type: nextPart.partType,
              orderNum: nextPart.partOrderNum,
              pages: nextPart.pages,
            },
            currentPageIndex: 0,
          };

          saveReadingSession(nextSession);
          setReadingSession(nextSession);
          navigate(`/stories/read?originalStoryId=${originalStoryId}`, {
            replace: true,
            state: { storyTitle: nextSession.storyTitle },
          });
          return;
        }

        if (
          !shouldStartNewSession &&
          storedSession?.originalStoryId === originalStoryId
        ) {
          setReadingSession(storedSession);
          return;
        }

        if (!Number.isInteger(childId) || childId <= 0) {
          throw new Error("동화를 읽을 아이를 먼저 선택해 주세요.");
        }

        const readingStart = await startReading(childId, originalStoryId);
        const newSession: ReadingSession = {
          readingHistoryId: readingStart.readingHistoryId,
          originalStoryId,
          storyTitle,
          selectedLevel: readingStart.level,
          currentPart: {
            type: readingStart.partType,
            orderNum: readingStart.partOrderNum,
            pages: readingStart.pages,
          },
          currentPageIndex: 0,
        };

        saveReadingSession(newSession);
        setReadingSession(newSession);
        navigate(`/stories/read?originalStoryId=${originalStoryId}`, {
          replace: true,
          state: { storyTitle: newSession.storyTitle },
        });
      } catch (error) {
        console.error("동화 읽기 초기화 오류:", error);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void initializeReading();
  }, [
    childId,
    navigate,
    originalStoryId,
    requestedLevel,
    retryCount,
    shouldAdvancePart,
    shouldStartNewSession,
    storyTitle,
  ]);

  const currentPart = readingSession?.currentPart;
  const pages = currentPart?.pages ?? [];
  const currentPageIndex = readingSession?.currentPageIndex ?? 0;
  const currentPage = pages[currentPageIndex];

  const moveToPage = (pageIndex: number) => {
    setReadingSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const nextSession = {
        ...currentSession,
        currentPageIndex: pageIndex,
      };

      saveReadingSession(nextSession);
      return nextSession;
    });
  };

  const handleRetry = () => {
    initializationStarted.current = false;
    setRetryCount((count) => count + 1);
  };

  const handlePrev = () => {
    if (currentPageIndex > 0) {
      moveToPage(currentPageIndex - 1);
    }
  };

  const handleNext = () => {
    if (!readingSession || !currentPart) {
      return;
    }

    if (currentPageIndex < pages.length - 1) {
      moveToPage(currentPageIndex + 1);
      return;
    }

    const quizParams = new URLSearchParams({
      originalStoryId: String(readingSession.originalStoryId),
      partType: currentPart.type,
    });

    navigate(`/stories/quiz?${quizParams.toString()}`, {
      state: { startQuizIndex: 0 },
    });
  };

  const handleReplay = () => {
    if (!currentPage || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      currentPage.sentences.map((sentence) => sentence.content).join(" "),
    );
    utterance.lang = "ko-KR";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className="story-reading-page">
      <Logo />

      <div className="story-reading-page__progress">
        <StoryProgressBar
          currentStep={currentPart?.orderNum ?? 1}
          totalSteps={TOTAL_PARTS}
        />
      </div>

      <button
        type="button"
        className="story-reading-page__replay-button"
        onClick={handleReplay}
        disabled={!currentPage}
      >
        <img
          src={replayIcon}
          alt=""
          aria-hidden="true"
          className="story-reading-page__replay-icon"
        />
        다시 듣기
      </button>

      {isLoading && (
        <p className="story-reading-page__status">동화를 불러오는 중...</p>
      )}

      {!isLoading && errorMessage && (
        <section className="story-reading-page__error" role="alert">
          <p className="story-reading-page__status">{errorMessage}</p>
          <button
            type="button"
            className="story-reading-page__retry-button"
            onClick={handleRetry}
          >
            다시 시도
          </button>
        </section>
      )}

      {!isLoading && !errorMessage && readingSession && currentPage && (
        <>
          <section className="story-reading-page__content">
            <img
              src={currentPage.imageUrl ?? readingPlaceholder}
              alt={`${readingSession.storyTitle} ${currentPage.pageNum}페이지`}
              className="story-reading-page__image"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = readingPlaceholder;
              }}
            />

            <div className="story-reading-page__text-block">
              <div className="story-reading-page__heading">
                <h1 className="story-reading-page__title">
                  {readingSession.storyTitle}
                </h1>
                <span className="story-reading-page__page-number">
                  {currentPageIndex + 1} / {pages.length}
                </span>
              </div>

              <div className="story-reading-page__sentences">
                {currentPage.sentences.map((sentence) => (
                  <p
                    key={sentence.sentenceIdx}
                    className="story-reading-page__sentence"
                  >
                    {sentence.content}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <div className="story-reading-page__actions">
            <button
              type="button"
              className="story-reading-page__nav-button"
              onClick={handlePrev}
              disabled={currentPageIndex === 0}
            >
              &lt; 이전
            </button>

            <button
              type="button"
              className="story-reading-page__nav-button"
              onClick={handleNext}
            >
              {currentPageIndex < pages.length - 1 ? "다음 >" : "퀴즈 풀기 >"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default StoryReadingPage;
