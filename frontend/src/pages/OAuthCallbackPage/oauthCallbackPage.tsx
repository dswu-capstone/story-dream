import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { exchangeSocialAuthorizationCode } from "../../api/auth";
import cloudLeft from "../../assets/cloud1.svg";
import cloudRight from "../../assets/cloud2.svg";
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
    <main className="oauth-callback-page">
      <section className="oauth-callback-container" aria-live="polite">
        <h1 className="oauth-callback-title">소셜 로그인</h1>

        {errorMessage ? (
          <>
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
          <p className="oauth-callback-message">로그인을 처리하고 있습니다.</p>
        )}
      </section>

      <img
        src={cloudLeft}
        alt=""
        className="oauth-callback-cloud oauth-callback-cloud-left"
      />
      <img
        src={cloudRight}
        alt=""
        className="oauth-callback-cloud oauth-callback-cloud-right"
      />
    </main>
  );
}

export default OAuthCallbackPage;
