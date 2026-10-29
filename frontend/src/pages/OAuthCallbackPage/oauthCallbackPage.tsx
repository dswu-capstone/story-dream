import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { exchangeSocialAuthorizationCode } from "../../api/auth";
import logo from "../../assets/logo.svg";
import type { SocialProvider } from "../../types/auth";
import { consumeSocialAuthRequest } from "../../utils/socialAuth";

import "./oauthCallbackPage.css";

type OAuthCallbackPageProps = {
  provider: SocialProvider;
};

function OAuthCallbackPage({ provider }: OAuthCallbackPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasStarted = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    const completeLogin = async () => {
      const searchParams = new URLSearchParams(location.search);
      const state = searchParams.get("state");

      if (!state) {
        throw new Error("소셜 로그인 요청 정보를 확인할 수 없습니다.");
      }

      const redirectTo = consumeSocialAuthRequest(provider, state);

      if (searchParams.get("error")) {
        throw new Error("소셜 로그인이 취소되었거나 승인되지 않았습니다.");
      }

      const code = searchParams.get("code");
      if (!code) {
        throw new Error("소셜 로그인 인증 코드를 받지 못했습니다.");
      }

      const loginResult = await exchangeSocialAuthorizationCode(provider, code);
      localStorage.setItem("accessToken", loginResult.accessToken);
      localStorage.setItem("tokenType", loginResult.tokenType);

      navigate(redirectTo, { replace: true });
    };

    void completeLogin().catch((error: unknown) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "소셜 로그인 처리 중 오류가 발생했습니다.",
      );
    });
  }, [location.search, navigate, provider]);

  return (
    <main className="oauth-callback-page" aria-busy={!errorMessage}>
      <img src={logo} alt="StoryDream" className="oauth-callback-logo" />

      <section className="oauth-callback-container" aria-live="polite">
        {errorMessage ? (
          <>
            <h1 className="oauth-callback-title">로그인에 실패했습니다</h1>
            <p className="oauth-callback-error">{errorMessage}</p>
            <button
              type="button"
              className="oauth-callback-button"
              onClick={() => navigate("/guardian/login", { replace: true })}
            >
              로그인 화면으로 돌아가기
            </button>
          </>
        ) : (
          <>
            <h1 className="oauth-callback-title">로그인 진행중입니다</h1>
            <div
              className="oauth-callback-spinner"
              role="status"
              aria-label="로그인 진행 중"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </>
        )}
      </section>

      <div
        className="oauth-callback-circle oauth-callback-circle-left"
        aria-hidden="true"
      />
      <div
        className="oauth-callback-circle oauth-callback-circle-right"
        aria-hidden="true"
      />
    </main>
  );
}

export default OAuthCallbackPage;
