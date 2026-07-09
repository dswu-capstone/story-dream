package com.storydream.backend.domain.child.service;

import com.storydream.backend.domain.child.dto.ChildCreateRequest;
import com.storydream.backend.domain.child.dto.ChildListResponse;
import com.storydream.backend.domain.child.dto.ChildProfileResponse;
import com.storydream.backend.domain.child.dto.ChildUpdateRequest;

public interface ChildService {

    ChildListResponse getChildren(Integer guardianId);

    void createChild(Integer guardianId, ChildCreateRequest request);

    ChildProfileResponse getChild(Integer guardianId, Integer childId);

    void updateChild(Integer guardianId, Integer childId, ChildUpdateRequest request);

    void deleteChild(Integer guardianId, Integer childId);
}