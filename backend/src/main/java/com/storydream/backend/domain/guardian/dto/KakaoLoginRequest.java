package com.storydream.backend.domain.guardian.dto;

import jakarta.validation.constraints.NotBlank;

public record KakaoLoginRequest(
        @NotBlank String code
) {}
