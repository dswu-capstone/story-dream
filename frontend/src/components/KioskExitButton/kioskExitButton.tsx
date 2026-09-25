import { useState } from "react";

import { sendLedPower } from "../../api/led";
import { readKioskFlags } from "./kioskFlags";
import "./kioskExitButton.css";

/**
 * 키오스크(전체화면)로 실행됐을 때만 화면 오른쪽 위에 뜨는 종료 버튼.
 *
 * 라즈베리파이 터치 화면에는 키보드가 없어 Alt+F4 로 나갈 수 없기 때문에,
 * 런처가 같이 띄운 제어 서버(rpi/quit-server.mjs)에 요청을 보내 앱을 종료한다.
 * 일반 브라우저(npm run dev 만 실행)에서는 렌더링되지 않는다.
 */

function KioskExitButton() {
  const [flags] = useState(readKioskFlags);
  const [asking, setAsking] = useState(false);
  const [quitting, setQuitting] = useState(false);

  if (!flags.isKiosk) return null;

  const quit = async () => {
    setQuitting(true);
    // 앱이 꺼지면 LED 도 끈다. (브라우저가 죽기 전에 나가도록 keepalive 요청)
    sendLedPower(false);
    try {
      await fetch(`http://127.0.0.1:${flags.port}/quit`, {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // 제어 서버가 없을 수도 있으니 창 닫기로 한 번 더 시도한다.
    }
    setTimeout(() => window.close(), 400);
  };

  const handleClick = () => {
    if (quitting) return;
    if (flags.needsConfirm) {
      setAsking(true);
      return;
    }
    void quit();
  };

  return (
    <>
      <button
        type="button"
        className="kiosk-exit"
        onClick={handleClick}
        disabled={quitting}
        aria-label="앱 종료"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {asking && (
        <div className="kiosk-exit__backdrop" role="dialog" aria-modal="true">
          <div className="kiosk-exit__dialog">
            <p className="kiosk-exit__text">앱을 종료할까요?</p>
            <div className="kiosk-exit__actions">
              <button
                type="button"
                className="kiosk-exit__button kiosk-exit__button--ghost"
                onClick={() => setAsking(false)}
              >
                아니요
              </button>
              <button
                type="button"
                className="kiosk-exit__button"
                onClick={() => void quit()}
                disabled={quitting}
              >
                {quitting ? "종료 중..." : "네"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default KioskExitButton;
