package com.storydream.backend.domain.child.service;

import com.storydream.backend.domain.child.dto.ChildListResponse;
import com.storydream.backend.domain.child.dto.ChildResponse;
import com.storydream.backend.domain.child.repository.ChildRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChildServiceImpl implements ChildService {

    private final ChildRepository childRepository;

    @Override
    public ChildListResponse getChildren(Integer guardianId) {

        List<ChildResponse> children = childRepository
                .findAllByGuardianIdOrderByIdAsc(guardianId)
                .stream()
                .map(child -> new ChildResponse(
                        child.getId(),
                        child.getName()
                ))
                .toList();

        return new ChildListResponse(children);
    }
}