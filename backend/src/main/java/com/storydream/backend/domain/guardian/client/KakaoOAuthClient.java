package com.storydream.backend.domain.guardian.client;

import com.storydream.backend.domain.guardian.dto.KakaoTokenResponse;
import com.storydream.backend.domain.guardian.dto.KakaoUserInfo;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

@Slf4j
@Component
public class KakaoOAuthClient {
    private static final String TOKEN_URI = "https://kauth.kakao.com/oauth/token";
    private static final String USER_INFO_URI = "https://kapi.kakao.com/v2/user/me";

    private final RestClient restClient;
    private final String clientId;       
    private final String clientSecret;
    private final String redirectUri;

    public KakaoOAuthClient(
            @Value("${oauth.kakao.client-id}") String clientId,
            @Value("${oauth.kakao.client-secret}") String clientSecret,
            @Value("${oauth.kakao.redirect-uri}") String redirectUri) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public KakaoTokenResponse getToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);

        if (clientSecret != null && !clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }

        try {
            KakaoTokenResponse response = restClient.post()
                    .uri(TOKEN_URI)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(KakaoTokenResponse.class);

            if (response == null || response.accessToken() == null) {
                throw new BusinessException(ErrorCode.KAKAO_LOGIN_FAILED);
            }
            return response;
        } catch (RestClientException e) {
            log.warn("카카오 토큰 발급 실패: {}", e.getMessage());
            throw new BusinessException(ErrorCode.KAKAO_LOGIN_FAILED);
        }
    }

    public KakaoUserInfo getUserInfo(String accessToken) {
        try {
            KakaoUserInfo userInfo = restClient.get()
                    .uri(USER_INFO_URI)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(KakaoUserInfo.class);

            if (userInfo == null || userInfo.id() == null) {
                throw new BusinessException(ErrorCode.KAKAO_LOGIN_FAILED);
            }
            return userInfo;
        } catch (RestClientException e) {
            log.warn("카카오 사용자 정보 조회 실패: {}", e.getMessage());
            throw new BusinessException(ErrorCode.KAKAO_LOGIN_FAILED);
        }
    }
}
