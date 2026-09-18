package com.storydream.backend.domain.focus.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;

@Schema(description = "Pi가 확정한 하나의 연속 이탈 구간. 재전송 및 복귀 시에도 같은 eventId 사용")
public record FocusEventRequest(
        @NotBlank @Size(max = 128) @Pattern(regexp = "\\S+") String eventId,
        @Schema(description = "이탈 확정 시각. 복귀 요청에서는 실제 복귀 시각. 서버와 동일한 시간대 사용")
        @NotNull LocalDateTime occurredAt,
        @Schema(description = "확정 시점까지 연속 이탈한 초. 복귀 요청에서는 전체 이탈 초")
        @NotNull @Min(10) Integer durationSeconds,
        @Schema(description = "생략 시 focus_lost. 복귀는 동일 행의 종료 시간만 갱신",
                allowableValues = {"focus_lost", "absent", "focus_recovered"})
        @Pattern(regexp = "focus_lost|absent|focus_recovered") String eventType
) {
    public String effectiveEventType() {
        return eventType == null ? "focus_lost" : eventType;
    }
}