import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";

type StorySentence = {
  sentenceIdx: number;
  content: string;
};

type StoryPage = {
  pageNum: number;
  sentences: StorySentence[];
};

type StoryDetail = {
  originalStoryId: number;
  storyLevelId: number;
  title: string;
  level: number;
  pages: StoryPage[];
};

type PageLayout = {
  className: string;
  sentenceGap: number;
  lineHeight: number;
  layoutLabel: string;
};

const mockStoryDetail: StoryDetail = {
  originalStoryId: 1,
  storyLevelId: 10,
  title: "꽃들의 봄맞이",
  level: 1,
  pages: [
    {
      pageNum: 1,
      sentences: [
        {
          sentenceIdx: 1,
          content: "봄이 왔어요!",
        },
        {
          sentenceIdx: 2,
          content: "꽃이 피었어요.",
        },
        {
          sentenceIdx: 3,
          content: "나비가 날아왔어요.",
        },
        {
          sentenceIdx: 4,
          content: "모두 기뻐했어요.",
        },
      ],
    },
    {
      pageNum: 2,
      sentences: [
        {
          sentenceIdx: 5,
          content:
            "분홍 치마를 입은 진달래꽃은 햇살 아래에서 살랑살랑 춤을 추었어요.",
        },
        {
          sentenceIdx: 6,
          content:
            "노란 개나리꽃은 가지를 흔들며 봄바람에게 반갑게 인사했어요.",
        },
        {
          sentenceIdx: 7,
          content:
            "작은 벌과 나비들은 꽃향기를 따라 숲속을 이리저리 날아다녔어요.",
        },
        {
          sentenceIdx: 8,
          content:
            "숲속 친구들은 따뜻한 봄이 찾아온 것을 함께 기뻐했답니다.",
        },
      ],
    },
    {
      pageNum: 3,
      sentences: [
        {
          sentenceIdx: 9,
          content:
            "그때 숲속 멀리에서 ‘따르릉, 따르릉!’ 하는 맑고 작은 소리가 들려왔어요.",
        },
        {
          sentenceIdx: 10,
          content:
            "꽃들이 고개를 들어 바라보니 조그만 인력거 한 대가 등불을 반짝이며 좁은 오솔길을 따라 천천히 다가오고 있었어요.",
        },
        {
          sentenceIdx: 11,
          content:
            "인력거를 끌고 있는 개구리는 땀을 뻘뻘 흘리면서도 힘차게 다리를 움직였고, 인력거에 탄 참새 색시는 꽃들에게 손을 흔들며 반갑게 인사했답니다.",
        },
        {
          sentenceIdx: 12,
          content:
            "모여 있던 꽃들은 예상하지 못한 손님의 등장에 깜짝 놀라 서로 얼굴을 바라보며 무슨 일이 생긴 것인지 궁금해했어요.",
        },
      ],
    },
    {
      pageNum: 4,
      sentences: [
        {
          sentenceIdx: 13,
          content: "참새 색시가 말했어요.",
        },
        {
          sentenceIdx: 14,
          content: "“내일 봄맞이 축제가 열려요!”",
        },
        {
          sentenceIdx: 15,
          content: "“모두 함께 준비해 주세요.”",
        },
        {
          sentenceIdx: 16,
          content: "꽃들은 힘차게 대답했어요.",
        },
      ],
    },
    {
      pageNum: 5,
      sentences: [
        {
          sentenceIdx: 17,
          content:
            "할미꽃은 아침 이슬을 정성껏 모아 달콤한 이슬 음료를 만들었어요.",
        },
        {
          sentenceIdx: 18,
          content:
            "개나리는 노란 꽃잎으로 만든 기다란 장식을 숲속 나무 사이에 걸었어요.",
        },
        {
          sentenceIdx: 19,
          content:
            "진달래꽃은 분홍 꽃잎을 한 장씩 모아 축제 무대를 아름답게 꾸몄어요.",
        },
        {
          sentenceIdx: 20,
          content:
            "나비들은 예쁜 옷을 입고 음악에 맞춰 춤추는 연습을 시작했답니다.",
        },
      ],
    },
    {
      pageNum: 6,
      sentences: [
        {
          sentenceIdx: 21,
          content:
            "해가 천천히 떠오르자 꽃잎에 맺힌 맑은 이슬방울이 작은 보석처럼 반짝이기 시작했고, 숲속 곳곳에는 따뜻하고 부드러운 햇빛이 가득 퍼졌어요.",
        },
        {
          sentenceIdx: 22,
          content:
            "제비는 숲속 구석구석을 빠르게 날아다니며 아직 잠에서 깨지 않은 꽃과 벌레들에게 봄맞이 축제가 곧 시작된다는 소식을 큰 목소리로 알려주었어요.",
        },
        {
          sentenceIdx: 23,
          content:
            "벌과 나비와 꽃들은 각자 맡은 일을 마무리하기 위해 더욱 바쁘게 움직였고, 숲속은 친구들의 웃음소리와 신나는 노랫소리로 가득 찼답니다.",
        },
        {
          sentenceIdx: 24,
          content:
            "드디어 멀리서 ‘딩동딩!’ 하는 시계 소리가 들려오자 모두가 하던 일을 멈추고 화려하게 꾸며진 무대 앞으로 하나둘씩 모여들었어요.",
        },
      ],
    },
    {
      pageNum: 7,
      sentences: [
        {
          sentenceIdx: 25,
          content: "축제가 시작됐어요!",
        },
        {
          sentenceIdx: 26,
          content: "모두 노래했어요.",
        },
        {
          sentenceIdx: 27,
          content: "모두 춤을 추었어요.",
        },
      ],
    },
  ],
};

function getPageLayout(page: StoryPage): PageLayout {
  const totalCharacterCount = page.sentences.reduce(
    (total, sentence) =>
      total + sentence.content.replace(/\s/g, "").length,
    0,
  );

  if (totalCharacterCount <= 50) {
    return {
      className:
        "story-reading-page__sentences--very-short",
      sentenceGap: 28,
      lineHeight: 1.65,
      layoutLabel: "짧은 문장 배치",
    };
  }

  if (totalCharacterCount <= 130) {
    return {
      className:
        "story-reading-page__sentences--normal",
      sentenceGap: 18,
      lineHeight: 1.5,
      layoutLabel: "기본 문장 배치",
    };
  }

  if (totalCharacterCount <= 220) {
    return {
      className:
        "story-reading-page__sentences--long",
      sentenceGap: 11,
      lineHeight: 1.38,
      layoutLabel: "긴 문장 배치",
    };
  }

  return {
    className:
      "story-reading-page__sentences--very-long",
    sentenceGap: 7,
    lineHeight: 1.27,
    layoutLabel: "매우 긴 문장 배치",
  };
}

function StoryReadingPage() {
  const [currentPageIndex, setCurrentPageIndex] =
    useState(0);

  const pages = mockStoryDetail.pages;
  const currentPage = pages[currentPageIndex];

  const pageLayout = useMemo(
    () => getPageLayout(currentPage),
    [currentPage],
  );

  const isFirstPage = currentPageIndex === 0;
  const isLastPage =
    currentPageIndex === pages.length - 1;

  const progress =
    ((currentPageIndex + 1) / pages.length) * 100;

  const handlePrev = () => {
    if (isFirstPage) {
      return;
    }

    setCurrentPageIndex((previous) => previous - 1);
  };

  const handleNext = () => {
    if (isLastPage) {
      return;
    }

    setCurrentPageIndex((previous) => previous + 1);
  };

  const handleReplay = () => {
    const pageText = currentPage.sentences
      .map((sentence) => sentence.content)
      .join(" ");

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(pageText);

    utterance.lang = "ko-KR";
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
  };

  const sentenceStyle = {
    "--sentence-gap":
      `${pageLayout.sentenceGap}px`,
    "--sentence-line-height":
      pageLayout.lineHeight,
  } as CSSProperties;

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          margin: 0;
        }

        body {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #d8d8d8;
        }

        button {
          font: inherit;
        }

        .story-reading-page {
          position: relative;
          width: 1024px;
          height: 600px;
          padding: 16px 28px 18px;
          overflow: hidden;
          background:
            linear-gradient(
              180deg,
              #fcffef 0%,
              #fdfdeb 100%
            );
          color: #222;
          font-family:
            Pretendard,
            "Noto Sans KR",
            sans-serif;
        }

        .story-reading-page__header {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 48px;
        }

        .story-reading-page__logo {
          position: absolute;
          top: 6px;
          left: 0;
          margin: 0;
          color: #526226;
          font-size: 23px;
          font-weight: 900;
        }

        .story-reading-page__progress {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .story-reading-page__progress-track {
          width: 290px;
          height: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e7c8;
        }

        .story-reading-page__progress-value {
          height: 100%;
          border-radius: inherit;
          background: #f2c94c;
          transition: width 0.2s ease;
        }

        .story-reading-page__page-number {
          min-width: 48px;
          color: #555;
          font-size: 14px;
          font-weight: 800;
        }

        .story-reading-page__replay-button {
          position: absolute;
          top: 2px;
          right: 0;
          height: 42px;
          padding: 0 15px;
          border: 0;
          border-radius: 11px;
          background: #f4c847;
          color: #222;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }

        .story-reading-page__content {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 30px;
          width: 100%;
          height: 458px;
          margin-top: 6px;
          padding: 20px;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow:
            0 14px 32px rgba(70, 75, 40, 0.12);
        }

        .story-reading-page__image {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          overflow: hidden;
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 74% 22%,
              #fff4a3 0,
              #fff0a3 9%,
              transparent 10%
            ),
            linear-gradient(
              180deg,
              #a9def0 0%,
              #d7efcd 62%,
              #8dc45e 63%,
              #6aa541 100%
            );
        }

        .story-reading-page__cloud {
          position: absolute;
          width: 88px;
          height: 28px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.88);
        }

        .story-reading-page__cloud::before,
        .story-reading-page__cloud::after {
          position: absolute;
          content: "";
          border-radius: 50%;
          background: inherit;
        }

        .story-reading-page__cloud::before {
          top: -18px;
          left: 14px;
          width: 42px;
          height: 42px;
        }

        .story-reading-page__cloud::after {
          top: -12px;
          right: 12px;
          width: 34px;
          height: 34px;
        }

        .story-reading-page__cloud--one {
          top: 90px;
          left: 42px;
        }

        .story-reading-page__cloud--two {
          top: 158px;
          right: 30px;
          transform: scale(0.72);
        }

        .story-reading-page__flower {
          position: absolute;
          bottom: 40px;
          font-size: 54px;
          line-height: 1;
        }

        .story-reading-page__flower--one {
          left: 38px;
        }

        .story-reading-page__flower--two {
          bottom: 62px;
          left: 150px;
        }

        .story-reading-page__flower--three {
          right: 56px;
        }

        .story-reading-page__image-label {
          position: absolute;
          right: 15px;
          bottom: 14px;
          padding: 5px 9px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.8);
          color: #555;
          font-size: 12px;
          font-weight: 800;
        }

        .story-reading-page__text-block {
          display: flex;
          min-width: 0;
          height: 100%;
          flex-direction: column;
        }

        .story-reading-page__title {
          margin: 1px 0 4px;
          color: #343b20;
          font-size: 29px;
          line-height: 1.25;
          text-align: center;
        }

        .story-reading-page__layout-label {
          align-self: center;
          margin-bottom: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          background: #eef1d7;
          color: #657130;
          font-size: 12px;
          font-weight: 800;
        }

        .story-reading-page__sentences {
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
          justify-content: center;
          gap: var(--sentence-gap);
          overflow: hidden;
        }

        .story-reading-page__sentence {
          margin: 0;
          line-height:
            var(--sentence-line-height);
          word-break: keep-all;
          overflow-wrap: break-word;
        }

        .story-reading-page__sentences--very-short
          .story-reading-page__sentence {
          font-size: 27px;
          font-weight: 760;
          text-align: center;
        }

        .story-reading-page__sentences--normal
          .story-reading-page__sentence {
          font-size: 22px;
          font-weight: 700;
        }

        .story-reading-page__sentences--long
          .story-reading-page__sentence {
          font-size: 18px;
          font-weight: 660;
        }

        .story-reading-page__sentences--very-long
          .story-reading-page__sentence {
          font-size: 15px;
          font-weight: 630;
        }

        .story-reading-page__actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 48px;
          margin-top: 6px;
        }

        .story-reading-page__nav-button {
          min-width: 116px;
          height: 42px;
          border: 0;
          border-radius: 12px;
          background: #74883e;
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .story-reading-page__nav-button:hover:not(
          :disabled
        ) {
          background: #657934;
        }

        .story-reading-page__nav-button:disabled {
          background: #c6cab6;
          color: #f2f2ee;
          cursor: not-allowed;
        }

        .story-reading-page__sentence-info {
          color: #777f5c;
          font-size: 13px;
          font-weight: 700;
        }
      `}</style>

      <main className="story-reading-page">
        <header className="story-reading-page__header">
          <h2 className="story-reading-page__logo">
            StoryDream
          </h2>

          <div className="story-reading-page__progress">
            <div className="story-reading-page__progress-track">
              <div
                className="story-reading-page__progress-value"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <span className="story-reading-page__page-number">
              {currentPageIndex + 1} / {pages.length}
            </span>
          </div>

          <button
            type="button"
            className="story-reading-page__replay-button"
            onClick={handleReplay}
          >
            다시 듣기
          </button>
        </header>

        <section className="story-reading-page__content">
          <div
            className="story-reading-page__image"
            aria-label="동화 임시 삽화"
          >
            <div
              className={
                "story-reading-page__cloud " +
                "story-reading-page__cloud--one"
              }
            />

            <div
              className={
                "story-reading-page__cloud " +
                "story-reading-page__cloud--two"
              }
            />

            <span
              className={
                "story-reading-page__flower " +
                "story-reading-page__flower--one"
              }
            >
              🌷
            </span>

            <span
              className={
                "story-reading-page__flower " +
                "story-reading-page__flower--two"
              }
            >
              🌼
            </span>

            <span
              className={
                "story-reading-page__flower " +
                "story-reading-page__flower--three"
              }
            >
              🌸
            </span>

            <span className="story-reading-page__image-label">
              {currentPage.pageNum}페이지 삽화
            </span>
          </div>

          <div className="story-reading-page__text-block">
            <h1 className="story-reading-page__title">
              {mockStoryDetail.title}
            </h1>

            <span className="story-reading-page__layout-label">
              {pageLayout.layoutLabel}
            </span>

            <div
              className={
                `story-reading-page__sentences ` +
                pageLayout.className
              }
              style={sentenceStyle}
            >
              {currentPage.sentences.map(
                (sentence) => (
                  <p
                    key={sentence.sentenceIdx}
                    className="story-reading-page__sentence"
                  >
                    {sentence.content}
                  </p>
                ),
              )}
            </div>
          </div>
        </section>

        <div className="story-reading-page__actions">
          <button
            type="button"
            className="story-reading-page__nav-button"
            onClick={handlePrev}
            disabled={isFirstPage}
          >
            {"< 이전"}
          </button>

          <span className="story-reading-page__sentence-info">
            현재 페이지 문장 수:{" "}
            {currentPage.sentences.length}개
          </span>

          <button
            type="button"
            className="story-reading-page__nav-button"
            onClick={handleNext}
            disabled={isLastPage}
          >
            {"다음 >"}
          </button>
        </div>
      </main>
    </>
  );
}

export default StoryReadingPage;