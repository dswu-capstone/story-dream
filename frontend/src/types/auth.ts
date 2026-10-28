export type SocialProvider = "google" | "kakao";

export type Guardian = {
  id: number;
  loginId: string;
  name: string;
};

export type LoginResult = {
  accessToken: string;
  tokenType: string;
  guardian: Guardian;
};
