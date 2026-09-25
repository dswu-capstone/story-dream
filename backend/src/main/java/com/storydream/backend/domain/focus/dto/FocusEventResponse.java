package com.storydream.backend.domain.focus.dto;

public record FocusEventResponse(Integer logId, Status status) {
    public enum Status {
        SAVED, ALREADY_PROCESSED, RECOVERED
    }
}