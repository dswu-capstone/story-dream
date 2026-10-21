package com.storydream.backend.domain.guardian.client;

import com.storydream.backend.domain.guardian.dto.GoogleTokenResponse;
import com.storydream.backend.domain.guardian.dto.GoogleUserInfo;
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
public class GoogleOAuthClient {
    private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final String USER_INFO_URI = "https://www.googleapis.com/oauth2/v3/userinfo";

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public GoogleOAuthClient(
            @Value("${oauth.google.client-id}") String clientId,
            @Value("${oauth.google.client-secret}") String clientSecret,
            @Value("${oauth.google.redirect-uri}") String redirectUri) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public GoogleTokenResponse getToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);

        try {
            GoogleTokenResponse response = restClient.post()
                    .uri(TOKEN_URI)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(GoogleTokenResponse.class);

            if (response == null || response.accessToken() == null) {
                throw new BusinessException(ErrorCode.GOOGLE_LOGIN_FAILED);
            }
            return response;
        } catch (RestClientException e) {
            log.warn("구글 토큰 발급 실패: {}", e.getMessage());
            throw new BusinessException(ErrorCode.GOOGLE_LOGIN_FAILED);
        }
    }

    public GoogleUserInfo getUserInfo(String accessToken) {
        try {
            GoogleUserInfo userInfo = restClient.get()
                    .uri(USER_INFO_URI)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(GoogleUserInfo.class);

            if (userInfo == null || userInfo.sub() == null) {
                throw new BusinessException(ErrorCode.GOOGLE_LOGIN_FAILED);
            }
            return userInfo;
        } catch (RestClientException e) {
            log.warn("구글 사용자 정보 조회 실패: {}", e.getMessage());
            throw new BusinessException(ErrorCode.GOOGLE_LOGIN_FAILED);
        }
    }
}
