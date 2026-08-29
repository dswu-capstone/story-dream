package com.storydream.backend.domain.child.controller;

import com.storydream.backend.domain.child.dto.ChildCreateRequest;
import com.storydream.backend.domain.child.dto.ChildListResponse;
import com.storydream.backend.domain.child.dto.ChildProfileResponse;
import com.storydream.backend.domain.child.dto.ChildUpdateRequest;
import com.storydream.backend.domain.child.service.ChildService;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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

    @Operation(
            summary = "아동 프로필 등록",
            description = """
                    로그인한 부모의 아동 프로필을 등록합니다.
                    """
    )
    @PostMapping
    public ResponseEntity<ApiResponse<Void>> createChild(
            Authentication authentication,
            @Valid @RequestBody ChildCreateRequest request
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        childService.createChild(guardianId, request);

        return ResponseEntity.ok(
                ApiResponse.success(null)
        );
    }


    @Operation(
            summary = "아동 프로필 조회",
            description = """
                    로그인한 부모에게 등록된 특정 아동의 프로필을 조회합니다.
                    """
    )
    @GetMapping("/{childId}")
    public ResponseEntity<ApiResponse<ChildProfileResponse>> getChild(
            Authentication authentication,
            @PathVariable Integer childId
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        return ResponseEntity.ok(
                ApiResponse.success(
                        childService.getChild(guardianId, childId)
                )
        );
    }
    @Operation(
            summary = "아동 프로필 수정",
            description = """
                    로그인한 부모에게 등록된 특정 아동의 프로필을 수정합니다.

                    - 전달된 필드만 수정합니다.
                    - 수정하지 않을 필드는 null로 보냅니다.
                    """
    )
    @PatchMapping("/{childId}")
    public ResponseEntity<ApiResponse<Void>> updateChild(
            Authentication authentication,
            @PathVariable Integer childId,
            @Valid @RequestBody ChildUpdateRequest request
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        childService.updateChild(guardianId, childId, request);

        return ResponseEntity.ok(
                ApiResponse.success(null)
        );
    }
    @Operation(
            summary = "아동 프로필 삭제",
            description = """
                    로그인한 부모에게 등록된 특정 아동 프로필을 삭제합니다.
                    """
    )
    @DeleteMapping("/{childId}")
    public ResponseEntity<ApiResponse<Void>> deleteChild(
            Authentication authentication,
            @PathVariable Integer childId
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        childService.deleteChild(guardianId, childId);

        return ResponseEntity.ok(
                ApiResponse.success(null)
        );
    }


}