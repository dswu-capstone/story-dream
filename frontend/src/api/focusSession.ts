import { realtimeInteractionApiBase, type RealtimeSession } from "./realtimeInteraction";
import { browserFocusRecording } from "./browserFocusRecording";

let operations: Promise<unknown> = Promise.resolve();
let stoppedHistoryId: number | null = null;
let activeHistoryId: number | null = null;
let activeMode: "camera" | "browser" | null = null;
let browserControlVersion = 0;

function ordered<T>(action: () => Promise<T>): Promise<T> {
  const result = operations.then(action);
  operations = result.catch(() => undefined);
  return result;
}

async function focusMode() {
  try {
    const response = await fetch(`${realtimeInteractionApiBase}/session`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("집중도 서버에 연결하지 못했습니다.");
    const session = await response.json() as RealtimeSession;
    const source = session.focus?.source;
    const expected = import.meta.env.VITE_FOCUS_SOURCE;
    if ((expected === "camera" || expected === "browser") && source !== expected) {
      throw new Error(`집중도 서버가 ${expected} 모드가 아닙니다.`);
    }
    if (source !== "camera" && source !== "browser") throw new Error("집중도 감지 모드를 확인할 수 없습니다.");
    if (activeHistoryId !== null && activeMode !== source) {
      throw new Error("독서 중 감지 모드가 변경되었습니다. 기존 모드로 복구 후 독서를 종료하세요.");
    }
    if (source === "camera") browserFocusRecording.suspend();
    return { source, timezone: session.focus?.timezone };
  } catch (error) {
    browserFocusRecording.suspend();
    throw error;
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
  const version = ++browserControlVersion;
  if (!detect || historyId === null) browserFocusRecording.pause();
  return ordered(async () => {
    if (historyId === stoppedHistoryId && historyId !== null) return;
    if (historyId === null) {
      if (activeHistoryId !== null) {
        if (activeMode === "browser") await browserFocusRecording.stop(activeHistoryId);
        else await request("stop", activeHistoryId);
      }
      activeHistoryId = null;
      activeMode = null;
      return;
    }
    const mode = await focusMode();
    if (mode.source === "browser") {
      // A slow previous route sync must not restart detection after pause/end was requested.
      if (version !== browserControlVersion) return;
      await browserFocusRecording.sync(historyId, detect, mode.timezone);
    }
    else await request("sync", historyId, detect);
    activeHistoryId = historyId;
    activeMode = mode.source;
  });
}

export function flushFocusEvents(historyId: number) {
  browserControlVersion++;
  browserFocusRecording.pause();
  return ordered(async () => {
    const mode = await focusMode();
    if (mode.source === "browser") {
      await browserFocusRecording.sync(historyId, false, mode.timezone);
      activeHistoryId = historyId;
      activeMode = mode.source;
      await browserFocusRecording.flush(historyId);
      return;
    }
    // Restore/renew the session in recovery-only mode before waiting for pending confirmations.
    await request("sync", historyId, false);
    activeHistoryId = historyId;
    activeMode = mode.source;
    await request("flush", historyId);
  });
}

export function stopFocusSession(historyId: number) {
  browserControlVersion++;
  browserFocusRecording.pause();
  return ordered(async () => {
    const mode = await focusMode();
    if (mode.source === "browser") await browserFocusRecording.stop(historyId);
    else await request("stop", historyId);
    stoppedHistoryId = historyId;
    activeHistoryId = null;
    activeMode = null;
  });
}
