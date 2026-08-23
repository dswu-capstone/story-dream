import backgroundHills from "../assets/background_hills.svg";
import characterCover from "../assets/character.svg";
import readingBookCover from "../assets/reading_book.svg";
import type {
  RecommendedStory,
  StoryDetail,
  StoryLanguageCode,
  StoryPageInfo,
} from "../types/story";

type StorySummaryResponse = {
  originalStoryId: number;
  title: string;
  languageCode?: StoryLanguageCode;
  tags?: string[];
};

type StoryRecommendationApiResponse = {
  success: boolean;
  data: {
    stories: StorySummaryResponse[];
    pageInfo: StoryPageInfo;
  };
  message: string | null;
};

type StorySentenceResponse = {
  sentenceIdx: number;
  content: string;
};

type StoryPageResponse = {
  pageId: number;
  pageNum: number;
  imageUrl: string | null;
  sentences: StorySentenceResponse[];
};

type StoryPartResponse = {
  type: string;
  orderNum: number;
  pages: StoryPageResponse[];
};

type StoryDetailApiResponse = {
  success: boolean;
  data: {
    originalStoryId: number;
    storyLevelId: number;
    title: string;
    level: number;
    parts: StoryPartResponse[];
  };
  message: string | null;
};

type GetRecommendedStoriesParams = {
  childId: number;
  languageCode?: StoryLanguageCode;
  page?: number;
  size?: number;
};

type RecommendedStoriesResult = {
  stories: RecommendedStory[];
  pageInfo: StoryPageInfo;
};

function normalizeStoryLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

const storyIllustrations = [
  characterCover,
  readingBookCover,
  backgroundHills,
] as const;

const storyPlaceholders = [
  {
    thumbnailSrc: characterCover,
  },
  {
    thumbnailSrc: readingBookCover,
  },
  {
    thumbnailSrc: backgroundHills,
  },
  {
    thumbnailSrc: readingBookCover,
  },
] as const;

const mockStoryTitles = [
  "아기 공룡 돌리",
  "우주로 떠난 고양이",
  "별님을 찾는 모험",
  "반짝반짝 별의 비밀",
  "무지개 마을의 하루",
  "구름 위를 걷는 소년",
  "바다를 찾은 작은 새",
  "반짝반짝 봄 소풍",
  "숲속 음악회",
  "공룡 친구의 생일",
  "달빛 연못의 약속",
  "별빛 마을의 비밀",
] as const;

export function getMockStoryDetail(originalStoryId = 1): StoryDetail {
  const title = mockStoryTitles[(originalStoryId - 1) % mockStoryTitles.length];

  return {
    originalStoryId,
    storyLevelId: originalStoryId * 10,
    title,
    level: 1,
    illustrationSrc:
      storyIllustrations[(originalStoryId - 1) % storyIllustrations.length],
    parts: [
      {
        type: "서론",
        orderNum: 1,
        pages: [
          {
            pageId: 1,
            pageNum: 1,
            imageUrl: null,
            sentences: [
              {
                sentenceIdx: 1,
                content: "돌리가 엉엉 울었어요.",
              },
              {
                sentenceIdx: 2,
                content: "그리고 엄마 손을 꼭 잡았어요.",
              },
            ],
          },
        ],
      },
      {
        type: "본론",
        orderNum: 2,
        pages: [
          {
            pageId: 2,
            pageNum: 1,
            imageUrl: null,
            sentences: [
              {
                sentenceIdx: 1,
                content: "엄마는 돌리 옆에 쪼그려 앉았어요.",
              },
              {
                sentenceIdx: 2,
                content: "그리고 돌리의 젖은 앞머리를 살며시 넘겨 주었어요.",
              },
              {
                sentenceIdx: 3,
                content: '"많이 속상했구나."',
              },
            ],
          },
        ],
      },
      {
        type: "결론",
        orderNum: 3,
        pages: [
          {
            pageId: 3,
            pageNum: 1,
            imageUrl: null,
            sentences: [
              {
                sentenceIdx: 1,
                content: "돌리는 조금씩 마음이 편안해졌어요.",
              },
              {
                sentenceIdx: 2,
                content: "그리고 다시 환하게 웃을 수 있었답니다.",
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function getRecommendedStories({
  childId,
  languageCode = "ko",
  page = 0,
  size = 4,
}: GetRecommendedStoriesParams): Promise<RecommendedStoriesResult> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const searchParams = new URLSearchParams({
    childId: String(childId),
    languageCode,
    page: String(page),
    size: String(size),
  });

  const response = await fetch(
    `/api/stories/recommendations?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("추천 동화 목록 조회 실패");
  }

  const result: StoryRecommendationApiResponse = await response.json();

  return {
    stories: result.data.stories.map((story, index) => {
      const resolvedLanguageCode = story.languageCode ?? languageCode;
      const placeholder = storyPlaceholders[index % storyPlaceholders.length];
      const title =
        resolvedLanguageCode === "en"
          ? story.title.replace(/^\d+_/, "")
          : story.title;
      const normalizedTitle = normalizeStoryLabel(title);
      const tagLabel =
        story.tags
          ?.map((tag) => tag.trim())
          .find(
            (tag) =>
              tag.length > 0 && normalizeStoryLabel(tag) !== normalizedTitle,
          ) ?? "";

      return {
        id: story.originalStoryId,
        title,
        languageCode: resolvedLanguageCode,
        thumbnailSrc: placeholder.thumbnailSrc,
        tagLabel,
      };
    }),
    pageInfo: result.data.pageInfo,
  };
}

export async function getStoryDetail(
  originalStoryId: number,
  level = 1,
): Promise<StoryDetail> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`/api/stories/${originalStoryId}?level=${level}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("동화 내용 조회 실패");
  }

  const result: StoryDetailApiResponse = await response.json();

  return {
    originalStoryId: result.data.originalStoryId,
    storyLevelId: result.data.storyLevelId,
    title: result.data.title,
    level: result.data.level,
    parts: result.data.parts,
    illustrationSrc:
      storyIllustrations[
      (result.data.originalStoryId - 1) % storyIllustrations.length
      ],
  };
}
