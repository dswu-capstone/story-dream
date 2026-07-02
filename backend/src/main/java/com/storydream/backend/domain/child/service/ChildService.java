package com.storydream.backend.domain.child.service;

import com.storydream.backend.domain.child.dto.ChildListResponse;

public interface ChildService {

    ChildListResponse getChildren(Integer guardianId);
}