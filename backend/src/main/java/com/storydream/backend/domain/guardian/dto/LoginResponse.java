package com.storydream.backend.domain.guardian.dto;

public record LoginResponse(String accessToken, String tokenType, GuardianResponse guardian) {

    public static LoginResponse of(String token, GuardianResponse guardian) {
        return new LoginResponse(token, "Bearer", guardian);
    }
}