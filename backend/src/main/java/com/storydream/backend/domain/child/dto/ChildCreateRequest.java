package com.storydream.backend.domain.child.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ChildCreateRequest(

        @NotBlank
        String name,

        @NotNull
        LocalDate birthDate,

        @NotNull
        @Min(1)
        @Max(3)
        Integer defaultLevel,

        String[] interest,

        @NotNull
        Boolean useParentVoice

) {
}