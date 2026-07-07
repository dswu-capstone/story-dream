export type RecommendedStory = {
  id: number;
  title: string;
  languageCode: string;
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

export type StoryPart = {
  type: string;
  orderNum: number;
  sentences: StorySentence[];
};

export type StoryDetail = {
  originalStoryId: number;
  storyLevelId: number;
  title: string;
  level: number;
  parts: StoryPart[];
  illustrationSrc: string;
};
