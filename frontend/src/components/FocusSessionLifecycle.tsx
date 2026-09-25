import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { syncFocusSession } from "../api/focusSession";
import { loadReadingSession } from "../utils/readingSession";

// Keep the Python episode alive across character/quiz routes so a brief navigation cannot split it.
export default function FocusSessionLifecycle() {
  const location = useLocation();
  useEffect(() => {
    const activeRoute = ["/stories/read", "/stories/interaction", "/stories/quiz", "/stories/result"]
      .includes(location.pathname) || location.pathname.startsWith("/children/level-adjust/");
    const detect = location.pathname === "/stories/read"
      && !(location.state as { advanceToNextPart?: boolean } | null)?.advanceToNextPart;
    let busy = false;
    const sync = async () => {
      if (busy) return;
      busy = true;
      try {
        await syncFocusSession(activeRoute ? loadReadingSession()?.readingHistoryId ?? null : null, detect);
      } catch (error) {
        console.warn("집중도 세션 연결 오류:", error);
      } finally { busy = false; }
    };
    void sync();
    const timer = window.setInterval(() => { void sync(); }, 5000);
    const onChange = () => { void sync(); };
    window.addEventListener("reading-session-changed", onChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("reading-session-changed", onChange);
      // Do not reset the episode on route changes. The next route sync or server lease handles exit.
    };
  }, [location.pathname, location.state]);
  return null;
}
