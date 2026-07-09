package com.storydream.backend.domain.child.dto;

import java.time.LocalDate;

public record ChildProfileResponse(
        Integer childId,
        String name,
        LocalDate birthDate,
        Integer initialLevel,
        String[] interest,
        Boolean useParentVoice
) {
}