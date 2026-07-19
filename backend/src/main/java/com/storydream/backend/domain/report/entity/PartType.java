package com.storydream.backend.domain.report.entity;

import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;

import java.util.Arrays;

/**
 * 문단 구분. DB에는 한글('서론','본론','결론')로 저장되어 있어 Converter로 매핑한다.
 * orderNum은 그래프 X축 정렬(서론 → 본론 → 결론)에 쓴다.
 */
public enum PartType {

    INTRO("서론", 1),
    BODY("본론", 2),
    CONCLUSION("결론", 3);

    private final String label;
    private final int orderNum;

    PartType(String label, int orderNum) {
        this.label = label;
        this.orderNum = orderNum;
    }

    public String getLabel() {
        return label;
    }

    public int getOrderNum() {
        return orderNum;
    }

    public static PartType from(String label) {
        return Arrays.stream(values())
                .filter(partType -> partType.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_PART_TYPE));
    }
}