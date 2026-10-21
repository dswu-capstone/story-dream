package com.storydream.backend.domain.guardian.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record KakaoUserInfo(
        Long id,                                             // 카카오 회원 고유 ID → social_account.provider_id
        @JsonProperty("kakao_account") KakaoAccount kakaoAccount
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KakaoAccount(
            Profile profile,
            String email
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Profile(
            String nickname
    ) {}

    public String nickname() {
        if (kakaoAccount == null || kakaoAccount.profile() == null) {
            return null;
        }
        return kakaoAccount.profile().nickname();
    }
}
