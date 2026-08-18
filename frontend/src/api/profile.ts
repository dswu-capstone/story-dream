import type { Profile } from "../types/profile";

type Child = {
  childId: number;
  name: string;
};

type ChildrenResponse = {
  success: boolean;
  data: {
    children: Child[];
  };
  message: string | null;
};

type ChildProfileResponse = {
  success: boolean;
  data: Child & {
    birthDate: string;
    defaultLevel: number;
    interest: string[];
    useParentVoice: boolean;
  };
  message: string | null;
};

function getAuthorizationHeader() {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  return { Authorization: `Bearer ${accessToken}` };
}

export async function getProfiles(): Promise<Profile[]> {
  const response = await fetch("/api/children", {
    method: "GET",
    headers: getAuthorizationHeader(),
  });

  if (!response.ok) {
    throw new Error("프로필 목록 조회 실패");
  }

  const result: ChildrenResponse = await response.json();

  return result.data.children.map((child) => ({
    id: child.childId,
    name: child.name,
  }));
}

export async function getProfile(childId: number): Promise<Profile> {
  const response = await fetch(`/api/children/${childId}`, {
    method: "GET",
    headers: getAuthorizationHeader(),
  });
  const result = (await response.json().catch(() => null)) as
    | ChildProfileResponse
    | null;

  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.message ?? "아동 프로필 조회 실패");
  }

  return {
    id: result.data.childId,
    name: result.data.name,
  };
}
