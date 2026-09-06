package com.storydream.backend.domain.child.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.time.LocalDate;

public record ChildUpdateRequest(

        String name,

        LocalDate birthDate,

        @Min(1)
        @Max(3)
        Integer defaultLevel,

        String[] interest

        // Boolean useParentVoice

) {
}