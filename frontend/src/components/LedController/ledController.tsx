import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { sendLedIdle, sendLedPower } from "../../api/led";

/**
 * LED 스트립 상태를 라우트에 맞춰 관리한다.
 *
 *  - 동화 읽기(/stories/read)  : StoryReadingPage 가 진행률(progress)을 직접 보냄
 *  - 퀴즈 결과(/stories/result): StoryResultPage 가 정답/오답(quiz)을 직접 보냄
 *  - 그 외 모든 화면            : 여기서 idle(노란색 60개 전체) 로 되돌림
 *
 * 렌더링은 없다.
 */
const SELF_MANAGED = ["/stories/read", "/stories/result"];

function LedController() {
  const { pathname } = useLocation();

  // 앱이 켜지면 LED 켜기 (엔코더 토글도 초기화)
  useEffect(() => {
    sendLedPower(true);
  }, []);

  useEffect(() => {
    if (!SELF_MANAGED.includes(pathname)) {
      sendLedIdle();
    }
  }, [pathname]);

  return null;
}

export default LedController;
