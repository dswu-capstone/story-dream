import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import "./storyReadingPage.css";

import {
  BrowserFocusMonitor,
  FOCUS_INTERACTION_THRESHOLD_SECONDS,
  subscribeFocusSignals,
  type FocusSignal,
} from "../../api/focusInteraction";
import { sendLedProgress } from "../../api/led";
import { getRealtimeSession } from "../../api/realtimeInteraction";
import readingPlaceholder from "../../assets/reading_book.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import type { ReadingSession } from "../../types/story";
import {
  getVisitedReadingParts,
  selectReadingPage,
  getReadingPageProgress,
  saveReadingSession,
} from "../../utils/readingSession";

import StoryPlayerControls from "../../components/StoryPlayerControls/storyPlayerControls";
import { initializeReadingSession } from "../../utils/readingFlow";
import { StoryAudioPlayer, type PlaybackStatus } from "../../utils/storyAudioPlayer";

type StoryReadingLocationState = {
  startNewSession?: boolean;
  advanceToNextPart?: boolean;
  fromPartOrderNum?: number;
  childId?: number;
  storyTitle?: string;
  selectedLevel?: number;
};

// 나레이션을 켤 때 HDMI 오디오 장치가 열리면서 돌입 전류가 흐르는데,
// 그 순간 웹캠까지 USB 전류를 쓰면 과전류로 패널이 리셋된다(화면·소리 동시 끊김).
// 그래서 재생 시작 전후 이 시간만 카메라를 놓았다가 바로 복귀시킨다.
// 0 이하로 두면 나레이션이 끝날 때까지 카메라를 멈춘다.
const CAMERA_PAUSE_AFTER_AUDIO_START_MS = 1000;

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

  const sessionRef = useRef<ReadingSession | null>(null);
  const leavingRef = useRef(false);
  const focusInteractionTriggered = useRef(false);
  const playerRef = useRef<StoryAudioPlayer | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("loading");
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [focusReady, setFocusReady] = useState(false);
  // 나레이션 재생 중에는 카메라를 잠시 놓아야 해서 바깥에서도 접근할 수 있게 둔다.
  const focusMonitorRef = useRef<BrowserFocusMonitor | null>(null);
  const cameraResumeTimerRef = useRef<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [readingSession, setReadingSession] = useState<ReadingSession | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let disposed = false;
    const initialize = async () => {
      setIsLoading(true);
      setFocusReady(false);
      setErrorMessage("");
      try {
        const session = await initializeReadingSession({
          key: location.key, originalStoryId, childId, storyTitle,
          startNewSession: shouldStartNewSession,
          advanceToNextPart: shouldAdvancePart,
          fromPartOrderNum: locationState?.fromPartOrderNum,
          selectedLevel: requestedLevel,
        });
        if (disposed) return;
        sessionRef.current = session;
        setReadingSession(session);
        if (shouldStartNewSession || shouldAdvancePart) {
          navigate(`/stories/read?originalStoryId=${originalStoryId}`, {
            replace: true, state: { storyTitle: session.storyTitle },
          });
        }
      } catch (error) {
        if (!disposed) setErrorMessage(getErrorMessage(error));
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };
    void initialize();
    return () => { disposed = true; };
  }, [childId, location.key, locationState?.fromPartOrderNum, navigate, originalStoryId,
    requestedLevel, retryCount, shouldAdvancePart, shouldStartNewSession, storyTitle]);

  const currentPart = readingSession?.currentPart;
  const pages = currentPart?.pages;
  const currentPageIndex = readingSession?.currentPageIndex ?? 0;
  const currentPage = pages?.[currentPageIndex];
  const pageProgress = readingSession
    ? getReadingPageProgress(readingSession)
    : { currentPage: 1, totalPages: 1 };

  // 읽기 진행률을 LED 스트립에 반영한다. (예: 10p 중 1p → 60개 중 6개 노란색)
  useEffect(() => {
    sendLedProgress(pageProgress.currentPage / pageProgress.totalPages);
  }, [pageProgress.currentPage, pageProgress.totalPages]);

  // 다음 페이지 이미지를 미리 받아두어 페이지 전환 시 바로 표시되도록 합니다.
  useEffect(() => {
    pages
      ?.slice(currentPageIndex + 1, currentPageIndex + 3)
      .forEach((page) => {
        if (!page.imageUrl) {
          return;
        }

        const image = new Image();
        image.src = page.imageUrl;
      });
  }, [currentPageIndex, pages]);

  const resumeCamera = useCallback(() => {
    if (cameraResumeTimerRef.current !== null) {
      window.clearTimeout(cameraResumeTimerRef.current);
      cameraResumeTimerRef.current = null;
    }
    if (!focusInteractionTriggered.current) {
      void focusMonitorRef.current?.resume().catch((error) => console.warn("카메라 재개 실패:", error));
    }
  }, []);

  const stopAudio = useCallback(() => {
    playerRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!readingSession?.readingHistoryId || isLoading || errorMessage) return;

    const subscribedAt = Date.now();
    const focusMonitor = new BrowserFocusMonitor();
    focusMonitorRef.current = focusMonitor;
    let disposed = false;

    const handleFocusSignal = (signal: FocusSignal) => {
      if (
        focusInteractionTriggered.current ||
        !["focus_lost", "absent"].includes(signal.eventType)
      ) {
        return;
      }

      const durationMatch = signal.detail?.match(/(?:distracted|absent)_for=(\d+(?:\.\d+)?)s/);
      const duration = durationMatch ? Number(durationMatch[1]) : null;
      if (
        duration !== null &&
        duration < FOCUS_INTERACTION_THRESHOLD_SECONDS
      ) {
        return;
      }

      const signalTime = signal.timestamp ? Date.parse(signal.timestamp) : NaN;
      if (Number.isFinite(signalTime) && signalTime < subscribedAt - 2_000) {
        return;
      }

      focusInteractionTriggered.current = true;
      stopAudio();
      window.speechSynthesis?.cancel();
      // 상호작용 화면은 마이크를 잡는다. 파이에서는 카메라를 먼저 완전히 놓아주지
      // 않으면 둘 다 물려서 죽으므로, 이동 전에 감지를 끊는다.
      focusMonitor.stop();
      navigate("/stories/interaction", {
        state: {
          focusTrigger: signal.eventType,
          focusDurationSeconds:
            duration ?? FOCUS_INTERACTION_THRESHOLD_SECONDS,
        },
      });
    };

    const unsubscribe = subscribeFocusSignals(handleFocusSignal);
    void getRealtimeSession()
      .then(async (session) => {
        if (!disposed && session.focus?.source !== "camera") {
          await focusMonitor.start();
        }
      })
      .catch((error) => {
        console.warn("집중도 감지 서버에 연결하지 못했습니다:", error);
      })
      .finally(() => { if (!disposed) setFocusReady(true); });

    return () => {
      disposed = true;
      unsubscribe();
      focusMonitor.stop();
      if (focusMonitorRef.current === focusMonitor) focusMonitorRef.current = null;
    };
  }, [errorMessage, isLoading, navigate, readingSession?.readingHistoryId, stopAudio]);

  const moveToPage = (pageNumber: number) => {
    const session = sessionRef.current;
    if (!session || leavingRef.current || focusInteractionTriggered.current) return;
    stopAudio();
    const next = selectReadingPage(session, pageNumber);
    sessionRef.current = next;
    saveReadingSession(next);
    setReadingSession(next);
    setPlaybackRevision((revision) => revision + 1);
  };

  const handleRetry = () => setRetryCount((count) => count + 1);
  const handlePrev = () => {
    if (sessionRef.current) moveToPage(getReadingPageProgress(sessionRef.current).currentPage - 1);
  };
  const handleNext = () => {
    const session = sessionRef.current;
    if (!session || leavingRef.current || focusInteractionTriggered.current) return;
    if (session.currentPageIndex < session.currentPart.pages.length - 1) {
      moveToPage(getReadingPageProgress(session).currentPage + 1);
      return;
    }
    const quiz = session.quizzesByPart?.[session.currentPart.orderNum];
    if (quiz?.completed) {
      const next = getVisitedReadingParts(session).find(({ part }) => part.orderNum === session.currentPart.orderNum + 1);
      if (next) { moveToPage(next.startPage); return; }
      const result = Object.values(quiz.results).find((answer) => answer.lastQuizOfPart);
      if (result) {
        leavingRef.current = true;
        stopAudio();
        navigate("/stories/result", { state: result });
        return;
      }
    }
    leavingRef.current = true;
    stopAudio();
    const quizParams = new URLSearchParams({
      originalStoryId: String(session.originalStoryId), partType: session.currentPart.type,
    });
    navigate(`/stories/quiz?${quizParams.toString()}`, { state: { startQuizIndex: 0 } });
  };

  const onAudioEnded = useEffectEvent(handleNext);
  useEffect(() => {
    const player = new StoryAudioPlayer({
      onStatus: setPlaybackStatus,
      onEnded: () => onAudioEnded(),
      onStart: () => {
        if (cameraResumeTimerRef.current !== null) window.clearTimeout(cameraResumeTimerRef.current);
        cameraResumeTimerRef.current = null;
        focusMonitorRef.current?.pause();
      },
      onRelease: resumeCamera,
      onPlaying: () => {
        if (cameraResumeTimerRef.current !== null) window.clearTimeout(cameraResumeTimerRef.current);
        if (CAMERA_PAUSE_AFTER_AUDIO_START_MS > 0) {
          cameraResumeTimerRef.current = window.setTimeout(resumeCamera, CAMERA_PAUSE_AFTER_AUDIO_START_MS);
        }
      },
    });
    playerRef.current = player;
    return () => { player.stop(); playerRef.current = null; };
  }, [resumeCamera]);

  useEffect(() => {
    if (isLoading || errorMessage || !focusReady || !currentPage || focusInteractionTriggered.current) return;
    playerRef.current?.setPage(currentPage.audioUrl);
    return stopAudio;
  }, [currentPage, playbackRevision, isLoading, errorMessage, focusReady, stopAudio]);

  return (
    <main className="story-reading-page">
      <Logo />

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
                  {pageProgress.currentPage} / {pageProgress.totalPages}
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

          <StoryPlayerControls
            playing={playbackStatus === "playing" || playbackStatus === "loading"}
            previousDisabled={pageProgress.currentPage <= getVisitedReadingParts(readingSession)[0].startPage}
            onPrevious={handlePrev}
            onToggle={() => playerRef.current?.toggle()}
            onNext={handleNext}
          />
          <p className="story-reading-page__audio-status" role="status">
            {playbackStatus === "blocked" && "재생 버튼을 누르면 동화를 이어서 들을 수 있어요."}
            {playbackStatus === "error" && "음성을 불러오지 못했어요. 재생 버튼을 눌러 다시 시도해 주세요."}
            {playbackStatus === "loading" && "음성을 준비하고 있어요…"}
          </p>
          <div className="story-progress-footer">
            <StoryProgressBar
              currentStep={pageProgress.currentPage}
              totalSteps={pageProgress.totalPages}
              maxAccessibleStep={Math.max(...getVisitedReadingParts(readingSession).map(({ part, startPage }) => startPage + part.pages.length - 1))}
              onSeek={moveToPage}
              onSeekStart={() => { stopAudio(); setPlaybackStatus("paused"); }}
            />
          </div>
        </>
      )}
    </main>
  );
}

export default StoryReadingPage;
