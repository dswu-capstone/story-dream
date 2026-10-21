//package com.storydream.backend.domain.guardian.service;
//
//import com.storydream.backend.domain.guardian.client.GoogleOAuthClient;
//import com.storydream.backend.domain.guardian.dto.GoogleTokenResponse;
//import com.storydream.backend.domain.guardian.dto.GoogleUserInfo;
//import com.storydream.backend.domain.guardian.dto.GuardianResponse;
//import com.storydream.backend.domain.guardian.dto.LoginResponse;
//import com.storydream.backend.domain.guardian.entity.Guardian;
//import com.storydream.backend.domain.guardian.entity.SocialAccount;
//import com.storydream.backend.domain.guardian.entity.SocialProvider;
//import com.storydream.backend.domain.guardian.repository.GuardianRepository;
//import com.storydream.backend.domain.guardian.repository.SocialAccountRepository;
//import com.storydream.backend.global.jwt.JwtTokenProvider;
//import lombok.RequiredArgsConstructor;
//import org.springframework.security.crypto.password.PasswordEncoder;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.util.UUID;
//
//@Service
//@RequiredArgsConstructor
//public class SocialAuthService {
//    private final GoogleOAuthClient googleOAuthClient;
//    private final GuardianRepository guardianRepository;
//    private final SocialAccountRepository socialAccountRepository;
//    private final PasswordEncoder passwordEncoder;
//    private final JwtTokenProvider jwtTokenProvider;
//
//    @Transactional
//    public LoginResponse googleLogin(String code) {
//        GoogleTokenResponse token = googleOAuthClient.getToken(code);
//
//        GoogleUserInfo userInfo = googleOAuthClient.getUserInfo(token.accessToken());
//
//        Guardian guardian = socialAccountRepository
//                .findByProviderAndProviderId(SocialProvider.GOOGLE, userInfo.sub())
//                .map(SocialAccount::getGuardian)
//                .orElseGet(() -> registerGoogleGuardian(userInfo));
//
//        String accessToken = jwtTokenProvider.createToken(guardian.getId(), guardian.getLoginId());
//        return LoginResponse.of(accessToken, GuardianResponse.from(guardian));
//    }
//
//    private Guardian registerGoogleGuardian(GoogleUserInfo userInfo) {
//        Guardian guardian = Guardian.builder()
//                .loginId("google_" + userInfo.sub())
//                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
//                .name(resolveName(userInfo))
//                .build();
//        guardianRepository.save(guardian);
//
//        SocialAccount socialAccount = SocialAccount.builder()
//                .guardian(guardian)
//                .provider(SocialProvider.GOOGLE)
//                .providerId(userInfo.sub())
//                .build();
//        socialAccountRepository.save(socialAccount);
//
//        return guardian;
//    }
//
//    private String resolveName(GoogleUserInfo userInfo) {
//        if (userInfo.name() != null && !userInfo.name().isBlank()) {
//            return userInfo.name();
//        }
//        if (userInfo.email() != null) {
//            return userInfo.email().split("@")[0];
//        }
//        return "보호자";
//    }
//}


package com.storydream.backend.domain.guardian.service;

import com.storydream.backend.domain.guardian.client.GoogleOAuthClient;
import com.storydream.backend.domain.guardian.client.KakaoOAuthClient;
import com.storydream.backend.domain.guardian.dto.GoogleTokenResponse;
import com.storydream.backend.domain.guardian.dto.GoogleUserInfo;
import com.storydream.backend.domain.guardian.dto.GuardianResponse;
import com.storydream.backend.domain.guardian.dto.KakaoTokenResponse;
import com.storydream.backend.domain.guardian.dto.KakaoUserInfo;
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
    private final KakaoOAuthClient kakaoOAuthClient;
    private final GuardianRepository guardianRepository;
    private final SocialAccountRepository socialAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    //구글
    @Transactional
    public LoginResponse googleLogin(String code) {
        GoogleTokenResponse token = googleOAuthClient.getToken(code);
        GoogleUserInfo userInfo = googleOAuthClient.getUserInfo(token.accessToken());

        Guardian guardian = findOrRegister(
                SocialProvider.GOOGLE,
                userInfo.sub(),
                resolveGoogleName(userInfo)
        );
        return createLoginResponse(guardian);
    }

    // 카카오
    @Transactional
    public LoginResponse kakaoLogin(String code) {
        KakaoTokenResponse token = kakaoOAuthClient.getToken(code);
        KakaoUserInfo userInfo = kakaoOAuthClient.getUserInfo(token.accessToken());

        Guardian guardian = findOrRegister(
                SocialProvider.KAKAO,
                String.valueOf(userInfo.id()),   // 카카오 id 는 숫자(Long) → 문자열로 저장
                resolveKakaoName(userInfo)
        );
        return createLoginResponse(guardian);
    }

    // 공통
    private Guardian findOrRegister(SocialProvider provider, String providerId, String name) {
        return socialAccountRepository
                .findByProviderAndProviderId(provider, providerId)
                .map(SocialAccount::getGuardian)
                .orElseGet(() -> register(provider, providerId, name));
    }

    private Guardian register(SocialProvider provider, String providerId, String name) {
        Guardian guardian = Guardian.builder()
                .loginId(provider.name().toLowerCase() + "_" + providerId)
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .name(name)
                .build();
        guardianRepository.save(guardian);

        SocialAccount socialAccount = SocialAccount.builder()
                .guardian(guardian)
                .provider(provider)
                .providerId(providerId)
                .build();
        socialAccountRepository.save(socialAccount);

        return guardian;
    }

    private LoginResponse createLoginResponse(Guardian guardian) {
        String accessToken = jwtTokenProvider.createToken(guardian.getId(), guardian.getLoginId());
        return LoginResponse.of(accessToken, GuardianResponse.from(guardian));
    }

    private String resolveGoogleName(GoogleUserInfo userInfo) {
        if (userInfo.name() != null && !userInfo.name().isBlank()) {
            return userInfo.name();
        }
        if (userInfo.email() != null) {
            return userInfo.email().split("@")[0];
        }
        return "보호자";
    }

    private String resolveKakaoName(KakaoUserInfo userInfo) {
        String nickname = userInfo.nickname();
        if (nickname != null && !nickname.isBlank()) {
            return nickname;
        }
        return "보호자";
    }
}