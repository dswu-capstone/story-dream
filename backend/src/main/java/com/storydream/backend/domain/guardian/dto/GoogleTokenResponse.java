package com.storydream.backend.domain.guardian.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GoogleTokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("id_token") String idToken,
        @JsonProperty("expires_in") Integer expiresIn,
        @JsonProperty("token_type") String tokenType,
        String scope
) {}
