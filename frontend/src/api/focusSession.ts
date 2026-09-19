import { realtimeInteractionApiBase, type RealtimeSession } from "./realtimeInteraction";

let operations: Promise<unknown> = Promise.resolve();
let stoppedHistoryId: number | null = null;
let activeHistoryId: number | null = null;

function ordered<T>(action: () => Promise<T>): Promise<T> {
  const result = operations.then(action);
  operations = result.catch(() => undefined);
  return result;
}

async function cameraMode() {
  try {
    const response = await fetch(`${realtimeInteractionApiBase}/session`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("집중도 서버에 연결하지 못했습니다.");
    const session = await response.json() as RealtimeSession;
    if (import.meta.env.VITE_FOCUS_SOURCE === "camera" && session.focus?.source !== "camera") {
      throw new Error("Pi 집중도 서버가 camera 모드가 아닙니다.");
    }
    return session.focus?.source === "camera";
  } catch (error) {
    if (import.meta.env.VITE_FOCUS_SOURCE === "camera" || activeHistoryId !== null) throw error;
    return false; // 기존 브라우저 개발 모드는 Spring 이벤트를 생성하지 않는다.
  }
}

async function request(action: "sync" | "flush" | "stop", readingHistoryId: number, detect = false) {
  const response = await fetch(`${realtimeInteractionApiBase}/focus/session`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, readingHistoryId, detect }),
    signal: AbortSignal.timeout(40_000),
  });
  const result = await response.json() as { ok?: boolean; enabled?: boolean; error?: string };
  if (!response.ok || !result.ok || !result.enabled) {
    throw new Error(result.error || "Pi 집중도 이벤트 처리를 완료하지 못했습니다.");
  }
}

export function syncFocusSession(historyId: number | null, detect: boolean) {
  return ordered(async () => {
    if (historyId === stoppedHistoryId && historyId !== null) return;
    if (!(await cameraMode())) return;
    if (historyId === null) {
      if (activeHistoryId !== null) await request("stop", activeHistoryId);
      activeHistoryId = null;
      return;
    }
    await request("sync", historyId, detect);
    activeHistoryId = historyId;
  });
}

export function flushFocusEvents(historyId: number) {
  return ordered(async () => {
    if (!(await cameraMode())) return;
    // Restore/renew the session in recovery-only mode before waiting for pending confirmations.
    await request("sync", historyId, false);
    activeHistoryId = historyId;
    await request("flush", historyId);
  });
}

export function stopFocusSession(historyId: number) {
  return ordered(async () => {
    if (!(await cameraMode())) return;
    await request("stop", historyId);
    stoppedHistoryId = historyId;
    activeHistoryId = null;
  });
}
