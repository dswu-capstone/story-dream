package com.storydream.backend.domain.child.dto;

import java.util.List;

public record ChildListResponse(
        List<ChildResponse> children
) {
}