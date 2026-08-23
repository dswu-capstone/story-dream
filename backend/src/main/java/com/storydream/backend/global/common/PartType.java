package com.storydream.backend.global.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum PartType {

    INTRO("서론", 1),
    BODY("본론", 2),
    CONCLUSION("결론", 3);

    private final String dbValue;
    private final int orderNum;

    public static PartType fromDbValue(String value) {
        return Arrays.stream(values())
                .filter(p -> p.dbValue.equals(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 part_type: " + value));
    }
}
