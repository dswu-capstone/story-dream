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
 
export async function getGuardian(signal?: AbortSignal): Promise<import("../types/auth").Guardian> {
  const response = await fetch("/api/guardians/me", {
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }, signal,
  });
  const result: ApiResponse<import("../types/auth").Guardian> = await response.json();
  if (!response.ok || !result.success || !result.data) throw new Error("보호자 정보 조회 실패");
  return result.data;
}
