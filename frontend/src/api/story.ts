import backgroundHills from "../assets/background_hills.svg";
import characterCover from "../assets/character.svg";
import readingBookCover from "../assets/reading_book.svg";
import type { RecommendedStory, StoryPageInfo } from "../types/story";

type StorySummaryResponse = {
  originalStoryId: number;
  title: string;
  languageCode: string;
};

type StoryRecommendationApiResponse = {
  success: boolean;
  data: {
    stories: StorySummaryResponse[];
    pageInfo: StoryPageInfo;
  };
  message: string | null;
};

type GetRecommendedStoriesParams = {
  childId: number;
  languageCode?: string;
  page?: number;
  size?: number;
};

type RecommendedStoriesResult = {
  stories: RecommendedStory[];
  pageInfo: StoryPageInfo;
};

const storyPlaceholders = [
  {
    thumbnailSrc: characterCover,
    categoryLabel: "공룡",
  },
  {
    thumbnailSrc: readingBookCover,
    categoryLabel: "우주",
  },
  {
    thumbnailSrc: backgroundHills,
    categoryLabel: "모험",
  },
  {
    thumbnailSrc: readingBookCover,
    categoryLabel: "상상",
  },
] as const;

const mockStoryTitles = [
  "아기 공룡 둘리",
  "우주로 떠난 고양이",
  "달님을 찾는 모험",
  "별빛 숲의 비밀",
  "무지개 마을의 하루",
  "구름 위를 걷는 토끼",
  "바다를 찾은 펭귄",
  "반짝반짝 별 여행",
  "숲속 음악회",
  "공룡 친구의 생일",
  "은하수 열차",
  "달빛 호수의 비밀",
];

export function getMockRecommendedStories(
  page = 0,
  size = 4,
): RecommendedStoriesResult {
  const totalElements = mockStoryTitles.length;
  const totalPages = Math.ceil(totalElements / size);
  const startIndex = page * size;
  const visibleTitles = mockStoryTitles.slice(startIndex, startIndex + size);

  return {
    stories: visibleTitles.map((title, index) => {
      const placeholder =
        storyPlaceholders[(startIndex + index) % storyPlaceholders.length];

      return {
        id: startIndex + index + 1,
        title,
        languageCode: "ko",
        thumbnailSrc: placeholder.thumbnailSrc,
        categoryLabel: placeholder.categoryLabel,
      };
    }),
    pageInfo: {
      page,
      size,
      totalPages,
      totalElements,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    },
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

  const response = await fetch(`/api/stories/recommendations?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("추천 동화 목록 조회 실패");
  }

  const result: StoryRecommendationApiResponse = await response.json();

  return {
    stories: result.data.stories.map((story, index) => {
      const placeholder = storyPlaceholders[index % storyPlaceholders.length];

      return {
        id: story.originalStoryId,
        title: story.title,
        languageCode: story.languageCode,
        thumbnailSrc: placeholder.thumbnailSrc,
        categoryLabel: placeholder.categoryLabel,
      };
    }),
    pageInfo: result.data.pageInfo,
  };
}
