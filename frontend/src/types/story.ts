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
