import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./storyRecommendPage.css";

import { recordRecommendationExposure } from "../../api/recommendation";
import { getRecommendedStories } from "../../api/story";
import ArrowButton from "../../components/ArrowButton/arrowButton";
import Logo from "../../components/Logo/logo";
import type {
  RecommendedStory,
  StoryLanguageCode,
  StoryPageInfo,
} from "../../types/story";
import { clearReadingSession } from "../../utils/readingSession";

const pageTitleSuffix = "에게 추천하는 이야기들";
const prevButtonLabel = "이전 추천 동화 보기";
const nextButtonLabel = "다음 추천 동화 보기";
const paginationLabel = "추천 동화 페이지 위치";
const emptyMessage = "추천할 동화가 아직 없어요.";
const exposureThreshold = 0.5;
const exposureDurationMs = 1000;

function createViewSessionId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function StoryRecommendPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childIdParam = searchParams.get("childId");
  const childNameParam = searchParams.get("name");
  const initialLanguageCode =
    searchParams.get("languageCode") === "en" ? "en" : "ko";

  const storedChildId = localStorage.getItem("selectedChildId");
  const storedChildName = localStorage.getItem("selectedChildName");

  const childId = Number(childIdParam ?? storedChildId ?? 0);
  const childName = childNameParam ?? storedChildName ?? "우리 아이";

  const [stories, setStories] = useState<RecommendedStory[]>([]);
  const [recommendationId, setRecommendationId] = useState<number | null>(null);
  const [viewSessionId, setViewSessionId] = useState("");
  const [pageInfo, setPageInfo] = useState<StoryPageInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [languageCode, setLanguageCode] =
    useState<StoryLanguageCode>(initialLanguageCode);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const cardElementsRef = useRef(new Map<number, HTMLButtonElement>());
  const exposureIdsRef = useRef(new Map<number, number>());
  const exposureRequestsRef = useRef(
    new Map<number, Promise<number | null>>(),
  );

  useEffect(() => {
    let cancelled = false;

    const loadStories = async () => {
      if (!childId) {
        setStories([]);
        setRecommendationId(null);
        setViewSessionId("");
        setPageInfo(null);
        setErrorMessage("동화를 추천받을 아이를 먼저 선택해 주세요.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setRecommendationId(null);
      setViewSessionId("");
      exposureIdsRef.current.clear();
      exposureRequestsRef.current.clear();

      try {
        const result = await getRecommendedStories({
          childId,
          languageCode,
          page: currentPage,
          size: 4,
        });

        if (cancelled) {
          return;
        }

        setStories(result.stories);
        setRecommendationId(result.recommendationId);
        setViewSessionId(createViewSessionId());
        setPageInfo(result.pageInfo);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("추천 동화 조회 오류:", error);
        setStories([]);
        setRecommendationId(null);
        setViewSessionId("");
        setPageInfo(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "추천 동화 목록을 불러오지 못했습니다.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadStories();

    return () => {
      cancelled = true;
    };
  }, [childId, currentPage, languageCode]);

  const trackExposure = useCallback(
    (story: RecommendedStory): Promise<number | null> => {
      if (!recommendationId || !viewSessionId) {
        return Promise.resolve(null);
      }

      const existingId = exposureIdsRef.current.get(story.recommendationItemId);
      if (existingId) {
        return Promise.resolve(existingId);
      }

      const existingRequest = exposureRequestsRef.current.get(
        story.recommendationItemId,
      );
      if (existingRequest) {
        return existingRequest;
      }

      const request = recordRecommendationExposure(
        recommendationId,
        story.id,
        viewSessionId,
      )
        .then((exposureId) => {
          exposureIdsRef.current.set(story.recommendationItemId, exposureId);
          return exposureId;
        })
        .catch((error) => {
          console.warn("추천 노출 로그 저장 실패:", error);
          return null;
        })
        .finally(() => {
          exposureRequestsRef.current.delete(story.recommendationItemId);
        });

      exposureRequestsRef.current.set(story.recommendationItemId, request);
      return request;
    },
    [recommendationId, viewSessionId],
  );

  useEffect(() => {
    if (!recommendationId || !viewSessionId || stories.length === 0) {
      return;
    }

    const timers = new Map<number, number>();
    const storyByElement = new Map<Element, RecommendedStory>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const story = storyByElement.get(entry.target);
          if (!story) {
            return;
          }

          const itemId = story.recommendationItemId;
          const isVisible =
            entry.isIntersecting && entry.intersectionRatio >= exposureThreshold;

          if (!isVisible) {
            const timerId = timers.get(itemId);
            if (timerId !== undefined) {
              window.clearTimeout(timerId);
              timers.delete(itemId);
            }
            return;
          }

          if (
            timers.has(itemId) ||
            exposureIdsRef.current.has(itemId) ||
            exposureRequestsRef.current.has(itemId)
          ) {
            return;
          }

          const timerId = window.setTimeout(() => {
            timers.delete(itemId);
            void trackExposure(story);
          }, exposureDurationMs);
          timers.set(itemId, timerId);
        });
      },
      { threshold: [0, exposureThreshold, 1] },
    );

    stories.forEach((story) => {
      const element = cardElementsRef.current.get(story.recommendationItemId);
      if (element) {
        storyByElement.set(element, story);
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [recommendationId, stories, trackExposure, viewSessionId]);

  const handleLanguageChange = (nextLanguageCode: StoryLanguageCode) => {
    if (nextLanguageCode === languageCode) {
      return;
    }

    setCurrentPage(0);
    setLanguageCode(nextLanguageCode);
  };

  const handlePrev = () => {
    if (!pageInfo?.hasPrevious) {
      return;
    }

    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    if (!pageInfo?.hasNext) {
      return;
    }

    setCurrentPage((prev) => prev + 1);
  };

  const handleStoryClick = (story: RecommendedStory) => {
    clearReadingSession();
    navigate(`/stories/read?originalStoryId=${story.id}`, {
      state: {
        startNewSession: true,
        childId,
        storyTitle: story.title,
        recommendationTracking:
          recommendationId && viewSessionId
            ? {
                recommendationId,
                originalStoryId: story.id,
                viewSessionId,
                recommendationExposureId: exposureIdsRef.current.get(
                  story.recommendationItemId,
                ),
              }
            : undefined,
      },
    });
  };

  return (
    <main className="story-recommend-page">
      <Logo />

      <h1 className="story-recommend-page__title">
        {childName}
        {pageTitleSuffix}
      </h1>

      <div
        className="story-recommend-page__language-selector"
        role="group"
        aria-label="동화 언어 선택"
      >
        <button
          type="button"
          className={
            languageCode === "ko"
              ? "story-recommend-page__language-button story-recommend-page__language-button--active"
              : "story-recommend-page__language-button"
          }
          aria-pressed={languageCode === "ko"}
          onClick={() => handleLanguageChange("ko")}
        >
          한국어
        </button>
        <button
          type="button"
          className={
            languageCode === "en"
              ? "story-recommend-page__language-button story-recommend-page__language-button--active"
              : "story-recommend-page__language-button"
          }
          aria-pressed={languageCode === "en"}
          onClick={() => handleLanguageChange("en")}
        >
          English
        </button>
      </div>

      {isLoading && (
        <p className="story-recommend-page__status">불러오는 중...</p>
      )}

      {!isLoading && errorMessage && (
        <p className="story-recommend-page__status">{errorMessage}</p>
      )}

      {!isLoading && !errorMessage && stories.length === 0 && (
        <p className="story-recommend-page__status">{emptyMessage}</p>
      )}

      {!isLoading && !errorMessage && stories.length > 0 && (
        <>
          <section className="story-recommend-page__carousel">
            <ArrowButton
              direction="left"
              onClick={handlePrev}
              disabled={!pageInfo?.hasPrevious}
              ariaLabel={prevButtonLabel}
            />

            <div className="story-recommend-page__list">
              {stories.map((story) => (
                <button
                  key={story.recommendationItemId}
                  ref={(element) => {
                    if (element) {
                      cardElementsRef.current.set(
                        story.recommendationItemId,
                        element,
                      );
                    } else {
                      cardElementsRef.current.delete(story.recommendationItemId);
                    }
                  }}
                  type="button"
                  className="story-recommend-page__card"
                  onClick={() => handleStoryClick(story)}
                >
                  <img
                    src={story.thumbnailSrc}
                    alt=""
                    aria-hidden="true"
                    className="story-recommend-page__thumbnail"
                  />
                  <div className="story-recommend-page__card-body">
                    <strong className="story-recommend-page__card-title">
                      {story.title}
                    </strong>
                    {story.tagLabel && (
                      <span className="story-recommend-page__chip">
                        {story.tagLabel}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <ArrowButton
              direction="right"
              onClick={handleNext}
              disabled={!pageInfo?.hasNext}
              ariaLabel={nextButtonLabel}
            />
          </section>

          <div
            className="story-recommend-page__pagination"
            aria-label={paginationLabel}
          >
            {Array.from(
              { length: Math.max(pageInfo?.totalPages ?? 0, 1) },
              (_, index) => (
                <span
                  key={index}
                  className={
                    index === currentPage
                      ? "story-recommend-page__dot story-recommend-page__dot--active"
                      : "story-recommend-page__dot"
                  }
                />
              ),
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default StoryRecommendPage;
