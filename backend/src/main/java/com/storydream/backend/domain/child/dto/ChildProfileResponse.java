package com.storydream.backend.domain.child.dto;

import java.time.LocalDate;

public record ChildProfileResponse(
        Integer childId,
        String name,
        LocalDate birthDate,
        Integer defaultLevel,
        String[] interest,
        Boolean useParentVoice
) {
}