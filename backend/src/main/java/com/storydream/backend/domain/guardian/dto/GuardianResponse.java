package com.storydream.backend.domain.guardian.dto;

import com.storydream.backend.domain.guardian.entity.Guardian;

public record GuardianResponse(Integer id, String loginId, String name) {

    public static GuardianResponse from(Guardian g) {
        return new GuardianResponse(g.getId(), g.getLoginId(), g.getName());
    }
}