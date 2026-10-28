import type { LoginResult, SocialProvider } from "../types/auth";

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  message: string | null;
};

export async function exchangeSocialAuthorizationCode(
  provider: SocialProvider,
  code: string,
): Promise<LoginResult> {
  const response = await fetch(`/api/auth/${provider}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  const result = (await response.json().catch(() => null)) as
    | ApiResponse<LoginResult>
    | null;

  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.message ?? "소셜 로그인에 실패했습니다.");
  }

  return result.data;
}
