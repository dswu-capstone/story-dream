package com.storydream.backend.domain.guardian.service;

import com.storydream.backend.domain.guardian.dto.GuardianResponse;
import com.storydream.backend.domain.guardian.dto.LoginRequest;
import com.storydream.backend.domain.guardian.dto.LoginResponse;
import com.storydream.backend.domain.guardian.dto.SignupRequest;
import com.storydream.backend.domain.guardian.entity.Guardian;
import com.storydream.backend.domain.guardian.repository.GuardianRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import com.storydream.backend.global.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final GuardianRepository guardianRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public GuardianResponse signup(SignupRequest req) {
        if (guardianRepository.existsByLoginId(req.loginId())) {
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }
        Guardian guardian = Guardian.builder()
                .loginId(req.loginId())
                .password(passwordEncoder.encode(req.password())) // 암호화
                .name(req.name())
                .build();
        return GuardianResponse.from(guardianRepository.save(guardian));
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        Guardian guardian = guardianRepository.findByLoginId(req.loginId())
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_FAILED));

        if (!passwordEncoder.matches(req.password(), guardian.getPassword())) {
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }
        String token = jwtTokenProvider.createToken(guardian.getId(), guardian.getLoginId());
        return LoginResponse.of(token, GuardianResponse.from(guardian));
    }

    @Transactional(readOnly = true)
    public GuardianResponse getMe(Integer guardianId) {
        Guardian guardian = guardianRepository.findById(guardianId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GUARDIAN_NOT_FOUND));
        return GuardianResponse.from(guardian);
    }
}