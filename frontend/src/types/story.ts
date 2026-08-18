export type StoryLanguageCode = "ko" | "en";

export type RecommendedStory = {
  id: number;
  title: string;
  languageCode: StoryLanguageCode;
  thumbnailSrc: string;
  categoryLabel: string;
};

export type StoryPageInfo = {
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type StorySentence = {
  sentenceIdx: number;
  content: string;
};

export type StoryPage = {
  pageId: number;
  pageNum: number;
  imageUrl: string | null;
  sentences: StorySentence[];
};

export type StoryPart = {
  type: string;
  orderNum: number;
  pages: StoryPage[];
};

export type StoryDetail = {
  originalStoryId: number;
  storyLevelId: number;
  title: string;
  level: number;
  parts: StoryPart[];
  illustrationSrc: string;
};

export type ReadingSession = {
  readingHistoryId: number;
  originalStoryId: number;
  storyTitle: string;
  selectedLevel: number;
  currentPart: StoryPart;
  currentPageIndex: number;
};
