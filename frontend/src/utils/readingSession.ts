import type { ReadingSession } from "../types/story";

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

export function clearReadingSession() {
  sessionStorage.removeItem(READING_SESSION_KEY);
}
