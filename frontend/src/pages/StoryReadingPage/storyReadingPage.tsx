import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "./storyReadingPage.css";

import { getMockStoryDetail, getStoryDetail } from "../../api/story";
import replayIcon from "../../assets/mingcute_voice-line.svg";
import Logo from "../../components/Logo/logo";
import StoryProgressBar from "../../components/StoryProgressBar/storyProgressBar";
import type { StoryDetail } from "../../types/story";

const prevLabel = "< 이전";
const nextLabel = "다음 >";
const replayLabel = "다시 듣기";

function StoryReadingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storyIdParam = Number(searchParams.get("storyId") ?? 1);
  const levelParam = Number(searchParams.get("level") ?? 1);
  const resolvedStoryId = storyIdParam;

  const [storyDetail, setStoryDetail] = useState<StoryDetail | null>(null);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoryDetail = async () => {
      setIsLoading(true);

      try {
        const data = await getStoryDetail(resolvedStoryId, levelParam);
        setStoryDetail(data);
      } catch (error) {
        console.error("동화 내용 조회 오류:", error);
        setStoryDetail(getMockStoryDetail(resolvedStoryId));
      } finally {
        setIsLoading(false);
      }
    };

    void loadStoryDetail();
  }, [levelParam, resolvedStoryId]);

  useEffect(() => {
    setCurrentPartIndex(0);
  }, [storyDetail?.originalStoryId]);

  const parts = storyDetail?.parts ?? [];
  const currentPart = parts[currentPartIndex];
  const totalSteps = Math.max(parts.length, 1);
  const currentStep = Math.min(currentPartIndex + 1, totalSteps);

  const handlePrev = () => {
    setCurrentPartIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    if (currentPartIndex >= parts.length - 1) {
      navigate("/stories/complete");
      return;
    }

    setCurrentPartIndex((prev) => prev + 1);
  };

  return (
    <main className="story-reading-page">
      <Logo />

      <div className="story-reading-page__progress">
        <StoryProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      </div>

      <button type="button" className="story-reading-page__replay-button">
        <img
          src={replayIcon}
          alt=""
          aria-hidden="true"
          className="story-reading-page__replay-icon"
        />
        {replayLabel}
      </button>

      {isLoading && (
        <p className="story-reading-page__status">동화를 불러오는 중...</p>
      )}

      {!isLoading && storyDetail && currentPart && (
        <>
          <section className="story-reading-page__content">
            <img
              src={storyDetail.illustrationSrc}
              alt=""
              aria-hidden="true"
              className="story-reading-page__image"
            />

            <div className="story-reading-page__text-block">
              <h1 className="story-reading-page__title">{storyDetail.title}</h1>

              <div className="story-reading-page__sentences">
                {currentPart.sentences.map((sentence) => (
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
              disabled={currentPartIndex === 0}
            >
              {prevLabel}
            </button>

            <button
              type="button"
              className="story-reading-page__nav-button"
              onClick={handleNext}
            >
              {nextLabel}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default StoryReadingPage;
