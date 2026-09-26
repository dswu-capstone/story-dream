package com.storydream.backend.domain.guardian.service;

import com.storydream.backend.domain.guardian.client.GoogleOAuthClient;
import com.storydream.backend.domain.guardian.dto.GoogleTokenResponse;
import com.storydream.backend.domain.guardian.dto.GoogleUserInfo;
import com.storydream.backend.domain.guardian.dto.GuardianResponse;
import com.storydream.backend.domain.guardian.dto.LoginResponse;
import com.storydream.backend.domain.guardian.entity.Guardian;
import com.storydream.backend.domain.guardian.entity.SocialAccount;
import com.storydream.backend.domain.guardian.entity.SocialProvider;
import com.storydream.backend.domain.guardian.repository.GuardianRepository;
import com.storydream.backend.domain.guardian.repository.SocialAccountRepository;
import com.storydream.backend.global.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SocialAuthService {
    private final GoogleOAuthClient googleOAuthClient;
    private final GuardianRepository guardianRepository;
    private final SocialAccountRepository socialAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public LoginResponse googleLogin(String code) {
        GoogleTokenResponse token = googleOAuthClient.getToken(code);

        GoogleUserInfo userInfo = googleOAuthClient.getUserInfo(token.accessToken());

        Guardian guardian = socialAccountRepository
                .findByProviderAndProviderId(SocialProvider.GOOGLE, userInfo.sub())
                .map(SocialAccount::getGuardian)
                .orElseGet(() -> registerGoogleGuardian(userInfo));

        String accessToken = jwtTokenProvider.createToken(guardian.getId(), guardian.getLoginId());
        return LoginResponse.of(accessToken, GuardianResponse.from(guardian));
    }

    private Guardian registerGoogleGuardian(GoogleUserInfo userInfo) {
        Guardian guardian = Guardian.builder()
                .loginId("google_" + userInfo.sub())
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .name(resolveName(userInfo))
                .build();
        guardianRepository.save(guardian);

        SocialAccount socialAccount = SocialAccount.builder()
                .guardian(guardian)
                .provider(SocialProvider.GOOGLE)
                .providerId(userInfo.sub())
                .build();
        socialAccountRepository.save(socialAccount);

        return guardian;
    }

    private String resolveName(GoogleUserInfo userInfo) {
        if (userInfo.name() != null && !userInfo.name().isBlank()) {
            return userInfo.name();
        }
        if (userInfo.email() != null) {
            return userInfo.email().split("@")[0];
        }
        return "보호자";
    }
}
