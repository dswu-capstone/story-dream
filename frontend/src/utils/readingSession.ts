import type { ReadingSession, StoryPart } from "../types/story";

const READING_SESSION_KEY = "storyDream.readingSession";

export function loadReadingSession(): ReadingSession | null {
  const storedSession = sessionStorage.getItem(READING_SESSION_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    const session = JSON.parse(storedSession) as ReadingSession;

    if (
      !Number.isInteger(session.readingHistoryId) ||
      !Number.isInteger(session.originalStoryId) ||
      !Number.isInteger(session.selectedLevel) ||
      !session.currentPart ||
      !Array.isArray(session.currentPart.pages)
    ) {
      clearReadingSession();
      return null;
    }

    return session;
  } catch {
    clearReadingSession();
    return null;
  }
}

export function saveReadingSession(session: ReadingSession) {
  sessionStorage.setItem(READING_SESSION_KEY, JSON.stringify(session));
}

export function getReadingPageProgress(session: ReadingSession) {
  const fallbackCurrentPage = session.currentPageIndex + 1;
  const fallbackTotalPages = Math.max(session.currentPart.pages.length, 1);

  return {
    currentPage: Math.min(
      Math.max(session.pageProgress?.currentPage ?? fallbackCurrentPage, 1),
      Math.max(session.pageProgress?.totalPages ?? fallbackTotalPages, 1),
    ),
    totalPages: Math.max(
      session.pageProgress?.totalPages ?? fallbackTotalPages,
      1,
    ),
  };
}

export function createReadingPageProgress(
  parts: StoryPart[],
  currentPartOrderNum: number,
  currentPageIndex: number,
) {
  const orderedParts = [...parts].sort(
    (first, second) => first.orderNum - second.orderNum,
  );
  const totalPages = Math.max(
    orderedParts.reduce((total, part) => total + part.pages.length, 0),
    1,
  );
  const previousPageCount = orderedParts
    .filter((part) => part.orderNum < currentPartOrderNum)
    .reduce((total, part) => total + part.pages.length, 0);

  return {
    currentPage: Math.min(
      previousPageCount + Math.max(currentPageIndex, 0) + 1,
      totalPages,
    ),
    totalPages,
  };
}

export function createNextReadingPageProgress(
  session: ReadingSession,
  parts: StoryPart[],
  nextPartOrderNum: number,
) {
  const currentProgress = getReadingPageProgress(session);
  const remainingPageCount = parts
    .filter((part) => part.orderNum >= nextPartOrderNum)
    .reduce((total, part) => total + part.pages.length, 0);
  const totalPages = Math.max(
    currentProgress.currentPage + remainingPageCount,
    currentProgress.currentPage + 1,
  );

  return {
    currentPage: Math.min(currentProgress.currentPage + 1, totalPages),
    totalPages,
  };
}

export function clearReadingSession() {
  sessionStorage.removeItem(READING_SESSION_KEY);
}
