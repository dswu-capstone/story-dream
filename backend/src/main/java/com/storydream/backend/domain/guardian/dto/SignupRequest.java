package com.storydream.backend.domain.guardian.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank String loginId,
        @NotBlank String password,
        @NotBlank String name
) {}