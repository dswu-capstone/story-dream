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

export async function getProfiles(): Promise<Profile[]> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch("/api/children", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
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
