import { getNextReadingPart, startReading } from "../api/reading";
import { getStoryDetail } from "../api/story";
import type { ReadingSession } from "../types/story";
import {
  getReadingPageProgress, getVisitedReadingParts, loadReadingSession,
  rememberReadingPart, saveReadingSession, selectReadingPage, updateReadingPageCounts,
} from "./readingSession";

type ReadingRequest = {
  key: string;
  originalStoryId: number;
  childId: number;
  storyTitle: string;
  startNewSession: boolean;
  advanceToNextPart: boolean;
  fromPartOrderNum?: number;
  selectedLevel?: number;
};

// Share mutations across Strict Mode effect replay; retain successful start responses
// so a failed detail GET can be retried without creating another reading history.
let startRequest: { key: string; promise: ReturnType<typeof startReading> } | undefined;
const advancing = new Map<string, Promise<ReadingSession>>();

async function advance(session: ReadingSession, fromOrder: number, level: number) {
  const cached = getVisitedReadingParts(session).find(({ part }) => part.orderNum === fromOrder + 1);
  if (cached) return selectReadingPage(session, cached.startPage);
  if (session.currentPart.orderNum !== fromOrder || !session.quizzesByPart?.[fromOrder]?.completed) {
    throw new Error("현재 파트의 퀴즈를 모두 완료해 주세요.");
  }
  const key = `${session.readingHistoryId}:${fromOrder}`;
  const existing = advancing.get(key);
  if (existing) return existing;
  const request = (async () => {
    const next = await getNextReadingPart(session.readingHistoryId, level);
    const previous = getVisitedReadingParts(session).find(({ part }) => part.orderNum === fromOrder)!;
    const startPage = previous.startPage + previous.part.pages.length;
    const updated = rememberReadingPart({
      ...rememberReadingPart(session),
      currentPart: { type: next.partType, orderNum: next.partOrderNum, pages: next.pages },
      selectedLevel: next.level,
      currentPageIndex: 0,
      partPageCounts: undefined,
      pageProgress: {
        currentPage: startPage,
        totalPages: Math.max(getReadingPageProgress(session).totalPages, startPage + next.pages.length - 1),
      },
    });
    // Persist the mutation before the optional detail GET, including when that GET fails.
    saveReadingSession(updated);
    return updated;
  })();
  advancing.set(key, request);
  try { return await request; } finally { advancing.delete(key); }
}

export async function initializeReadingSession(request: ReadingRequest): Promise<ReadingSession> {
  if (!Number.isInteger(request.originalStoryId) || request.originalStoryId <= 0) {
    throw new Error("읽을 동화 정보가 없습니다.");
  }
  let session = loadReadingSession();
  if (request.advanceToNextPart) {
    if (!session || session.originalStoryId !== request.originalStoryId) {
      throw new Error("진행 중인 독서 기록을 찾을 수 없습니다.");
    }
    session = await advance(session, request.fromPartOrderNum ?? session.currentPart.orderNum,
      request.selectedLevel ?? session.selectedLevel);
  } else if (request.startNewSession || session?.originalStoryId !== request.originalStoryId) {
    if (!Number.isInteger(request.childId) || request.childId <= 0) {
      throw new Error("동화를 읽을 아이를 먼저 선택해 주세요.");
    }
    if (startRequest?.key !== request.key) {
      startRequest = { key: request.key, promise: startReading(request.childId, request.originalStoryId) };
    }
    let start;
    try { start = await startRequest.promise; } catch (error) {
      startRequest = undefined;
      throw error;
    }
    session = rememberReadingPart({
      readingHistoryId: start.readingHistoryId,
      originalStoryId: request.originalStoryId,
      storyTitle: request.storyTitle,
      selectedLevel: start.level,
      currentPart: { type: start.partType, orderNum: start.partOrderNum, pages: start.pages },
      currentPageIndex: 0,
      quizzesByPart: {},
    });
    saveReadingSession(session);
  }
  if (!session) throw new Error("진행 중인 독서 기록을 찾을 수 없습니다.");
  session = rememberReadingPart(session);
  if (!session.partPageCounts) {
    const detail = await getStoryDetail(session.originalStoryId, session.selectedLevel);
    session = updateReadingPageCounts(session, detail.parts);
  }
  saveReadingSession(session);
  return session;
}
