package com.storydream.backend.domain.guardian.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GoogleUserInfo(
        String sub,
        String email,
        @JsonProperty("email_verified") Boolean emailVerified,
        String name,
        String picture
) {}
