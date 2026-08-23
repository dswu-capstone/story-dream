package com.storydream.backend.domain.focus.entity;

public enum FocusStatus {
    FRONT,
    SIDE,
    BACK,
    ABSENT;

    public boolean isDistracted() {
        return this != FRONT;
    }
}
