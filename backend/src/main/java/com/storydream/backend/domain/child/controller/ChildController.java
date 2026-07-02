package com.storydream.backend.domain.child.controller;

import com.storydream.backend.domain.child.dto.ChildListResponse;
import com.storydream.backend.domain.child.service.ChildService;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/children")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Child", description = "아동 관련 API")
public class ChildController {

    private final ChildService childService;

    @Operation(
            summary = "로그인한 부모의 아동 목록 조회",
            description = """
                    로그인한 부모에게 등록된 아동 목록을 조회합니다.

                    - 등록된 순서대로 반환합니다.
                    """
    )
    @GetMapping
    public ResponseEntity<ApiResponse<ChildListResponse>> getChildren(
            Authentication authentication
    ) {

        Integer guardianId = Integer.valueOf(authentication.getName());

        return ResponseEntity.ok(
                ApiResponse.success(
                        childService.getChildren(guardianId)
                )
        );
    }
}