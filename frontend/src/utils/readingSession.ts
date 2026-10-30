import type { ReadingQuizResult, ReadingSession, StoryPart } from "../types/story";

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
  window.dispatchEvent(new Event("reading-session-changed"));
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
  window.dispatchEvent(new Event("reading-session-changed"));
}

// Only pages returned by start/next-part are unlocked. Detail responses supply counts only.
export function getVisitedReadingParts(session: ReadingSession) {
  return session.visitedParts ?? [{
    part: session.currentPart,
    level: session.selectedLevel,
    startPage: getReadingPageProgress(session).currentPage - session.currentPageIndex,
  }];
}

export function rememberReadingPart(session: ReadingSession): ReadingSession {
  const visited = getVisitedReadingParts(session);
  if (visited.some(({ part }) => part.orderNum === session.currentPart.orderNum)) {
    return { ...session, visitedParts: visited };
  }
  return {
    ...session,
    visitedParts: [...visited, {
      part: session.currentPart,
      level: session.selectedLevel,
      startPage: getReadingPageProgress(session).currentPage - session.currentPageIndex,
    }].sort((a, b) => a.part.orderNum - b.part.orderNum),
  };
}

export function updateReadingPageCounts(session: ReadingSession, parts: StoryPart[]): ReadingSession {
  const visited = getVisitedReadingParts(session);
  const counts = Object.fromEntries(parts.map((part) => [part.orderNum, part.pages.length]));
  for (const entry of visited) counts[entry.part.orderNum] = entry.part.pages.length;
  return {
    ...session,
    partPageCounts: counts,
    pageProgress: {
      currentPage: getReadingPageProgress(session).currentPage,
      totalPages: Math.max(Object.values(counts).reduce((sum, count) => sum + count, 0), 1),
    },
  };
}

export function selectReadingPage(session: ReadingSession, pageNumber: number): ReadingSession {
  const visited = getVisitedReadingParts(session);
  const first = visited[0];
  const last = visited[visited.length - 1];
  const target = Math.max(first.startPage, Math.min(Math.round(pageNumber), last.startPage + last.part.pages.length - 1));
  const entry = visited.find(({ part, startPage }) => target >= startPage && target < startPage + part.pages.length);
  if (!entry) return session;
  return {
    ...session,
    currentPart: entry.part,
    selectedLevel: entry.level,
    currentPageIndex: target - entry.startPage,
    pageProgress: { ...getReadingPageProgress(session), currentPage: target },
  };
}

export function recordReadingQuiz(
  session: ReadingSession, quizId: number, quizIds: number[], result: ReadingQuizResult,
): ReadingSession {
  if (session.readingHistoryId !== result.readingHistoryId) return session;
  const previous = session.quizzesByPart?.[result.partOrderNum];
  const results = { ...previous?.results, [quizId]: previous?.results[quizId] ?? result };
  const completed = previous?.completed === true || (
    quizIds.length > 0 && quizIds.every((id) => results[id]) &&
    Object.values(results).some((answer) => answer.lastQuizOfPart)
  );
  return {
    ...session,
    quizzesByPart: { ...session.quizzesByPart, [result.partOrderNum]: { completed, results } },
  };
}
