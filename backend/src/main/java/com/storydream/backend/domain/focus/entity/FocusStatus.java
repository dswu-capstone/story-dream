package com.storydream.backend.domain.focus.entity;

public enum FocusStatus {
    FRONT,
    SIDE,
    BACK,
    ABSENT,
    DISTRACTED; // 최소 요청에는 자세 정보가 없으므로 특정 자세를 임의로 추정하지 않는다.

    public boolean isDistracted() {
        return this != FRONT;
    }
}
