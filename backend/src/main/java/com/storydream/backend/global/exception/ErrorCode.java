package com.storydream.backend.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;


@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    DUPLICATE_LOGIN_ID(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다."),
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다."),
    GUARDIAN_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다."),

    INVALID_STORY_LEVEL(HttpStatus.BAD_REQUEST, "잘못된 동화 난이도입니다."),
    STORY_NOT_FOUND(HttpStatus.NOT_FOUND, "동화를 찾을 수 없습니다."),
    STORY_LEVEL_NOT_FOUND(HttpStatus.NOT_FOUND, "해당 버전의 동화를 찾을 수 없습니다."),
    STORY_PART_NOT_FOUND(HttpStatus.NOT_FOUND, "해당 파트의 동화를 찾을 수 없습니다."),


    CHILD_NOT_FOUND(HttpStatus.NOT_FOUND,"자녀 정보를 찾을 수 없습니다."),

    READING_HISTORY_NOT_FOUND(HttpStatus.NOT_FOUND, "독서 기록을 찾을 수 없습니다."),
    READING_LOG_NOT_FOUND(HttpStatus.NOT_FOUND, "독서 로그를 찾을 수 없습니다."),
    INVALID_NEXT_PART(HttpStatus.BAD_REQUEST, "결론 이후에는 다음 파트가 없습니다."),

    QUIZ_NOT_FOUND(HttpStatus.NOT_FOUND, "퀴즈를 찾을 수 없습니다."),
    INVALID_PART_TYPE(HttpStatus.BAD_REQUEST, "문단 타입은 서론, 본론, 결론 중 하나여야 합니다."),
    AI_RECOMMENDATION_FAILED(HttpStatus.BAD_GATEWAY, "AI 추천 시스템 호출에 실패했습니다.");

    private final HttpStatus status;
    private final String message;
}
