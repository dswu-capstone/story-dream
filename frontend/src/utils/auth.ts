import type { NavigateFunction } from "react-router-dom";

export const navigateWithAuth = (
  navigate: NavigateFunction,
  targetPath: string
) => {
  const accesstoken = localStorage.getItem("accessToken");

  // 토큰 미존재
  if (!accesstoken) {
    navigate("/guardian/login", {
      state: {
        redirectTo: targetPath // 로그인 후 원래 가려던 페이지로 이동
      },
    });
    return;
  }
  // 토근 존재
  navigate(targetPath)
}