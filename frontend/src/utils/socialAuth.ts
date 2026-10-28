import type { SocialProvider } from "../types/auth";

const SOCIAL_AUTH_REQUEST_KEY = "storydream.social-auth-request";
const SOCIAL_AUTH_REQUEST_MAX_AGE_MS = 10 * 60 * 1000;

type SocialAuthRequest = {
  provider: SocialProvider;
  state: string;
  redirectTo: string;
  createdAt: number;
};

const providerConfig: Record<
  SocialProvider,
  {
    authorizationEndpoint: string;
    callbackPath: string;
    clientId: string | undefined;
  }
> = {
  google: {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    callbackPath: "/oauth/google/callback",
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  },
  kakao: {
    authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
    callbackPath: "/oauth/kakao/callback",
    clientId: import.meta.env.VITE_KAKAO_CLIENT_ID,
  },
};

function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

function getProviderLabel(provider: SocialProvider): string {
  return provider === "google" ? "Google" : "카카오";
}

export function startSocialLogin(
  provider: SocialProvider,
  redirectTo: string,
): void {
  const config = providerConfig[provider];

  if (!config.clientId) {
    throw new Error(`${getProviderLabel(provider)} 로그인 설정이 없습니다.`);
  }

  const state = window.crypto.randomUUID();
  const request: SocialAuthRequest = {
    provider,
    state,
    redirectTo: isSafeRedirectPath(redirectTo) ? redirectTo : "/guardian",
    createdAt: Date.now(),
  };

  sessionStorage.setItem(SOCIAL_AUTH_REQUEST_KEY, JSON.stringify(request));

  const redirectUri = `${window.location.origin}${config.callbackPath}`;
  const searchParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  if (provider === "google") {
    searchParams.set("scope", "openid email profile");
  }

  window.location.assign(
    `${config.authorizationEndpoint}?${searchParams.toString()}`,
  );
}

export function consumeSocialAuthRequest(
  provider: SocialProvider,
  returnedState: string,
): string {
  const storedRequest = sessionStorage.getItem(SOCIAL_AUTH_REQUEST_KEY);
  sessionStorage.removeItem(SOCIAL_AUTH_REQUEST_KEY);

  if (!storedRequest) {
    throw new Error("로그인 요청 정보를 찾을 수 없습니다. 다시 시도해 주세요.");
  }

  let request: SocialAuthRequest;

  try {
    request = JSON.parse(storedRequest) as SocialAuthRequest;
  } catch {
    throw new Error("로그인 요청 정보가 올바르지 않습니다. 다시 시도해 주세요.");
  }

  const isExpired =
    !Number.isFinite(request.createdAt) ||
    Date.now() - request.createdAt > SOCIAL_AUTH_REQUEST_MAX_AGE_MS;

  if (
    request.provider !== provider ||
    request.state !== returnedState ||
    isExpired
  ) {
    throw new Error("소셜 로그인 요청을 확인할 수 없습니다. 다시 시도해 주세요.");
  }

  return isSafeRedirectPath(request.redirectTo)
    ? request.redirectTo
    : "/guardian";
}
