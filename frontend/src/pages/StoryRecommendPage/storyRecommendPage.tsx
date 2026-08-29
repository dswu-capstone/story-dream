import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./storyRecommendPage.css";

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
  const [pageInfo, setPageInfo] = useState<StoryPageInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [languageCode, setLanguageCode] =
    useState<StoryLanguageCode>(initialLanguageCode);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadStories = async () => {
      if (!childId) {
        setStories([]);
        setPageInfo(null);
        setErrorMessage("동화를 추천받을 아이를 먼저 선택해 주세요.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await getRecommendedStories({
          childId,
          languageCode,
          page: currentPage,
          size: 4,
        });

        setStories(result.stories);
        setPageInfo(result.pageInfo);
      } catch (error) {
        console.error("추천 동화 조회 오류:", error);
        setStories([]);
        setPageInfo(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "추천 동화 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadStories();
  }, [childId, currentPage, languageCode]);

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
                  key={story.id}
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
