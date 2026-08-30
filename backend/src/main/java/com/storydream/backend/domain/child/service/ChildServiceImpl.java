package com.storydream.backend.domain.child.service;

import com.storydream.backend.domain.child.dto.*;
import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.guardian.entity.Guardian;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.storydream.backend.domain.guardian.repository.GuardianRepository;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChildServiceImpl implements ChildService {

    private final ChildRepository childRepository;
    private final GuardianRepository guardianRepository;

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

    @Override
    @Transactional
    public void createChild(
            Integer guardianId,
            ChildCreateRequest request
    ) {
        Guardian guardian = guardianRepository.findById(guardianId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GUARDIAN_NOT_FOUND));


        Child child = Child.builder()
                .guardian(guardian)
                .name(request.name())
                .birthDate(request.birthDate())
                .defaultLevel(request.defaultLevel())
                .interest(request.interest())
                // .useParentVoice(request.useParentVoice())
                .build();

        childRepository.save(child);
    }

    @Override
    public ChildProfileResponse getChild(
            Integer guardianId,
            Integer childId
    ) {

        Child child = getOwnedChild(guardianId, childId);

        return new ChildProfileResponse(
                child.getId(),
                child.getName(),
                child.getBirthDate(),
                child.getDefaultLevel(),
                child.getInterest()
                // child.getUseParentVoice()
        );
    }

    @Override
    @Transactional
    public void updateChild(
            Integer guardianId,
            Integer childId,
            ChildUpdateRequest request
    ) {

        Child child = getOwnedChild(guardianId, childId);

        child.updateProfile(
                request.name(),
                request.birthDate(),
                request.defaultLevel(),
                request.interest()
                // request.useParentVoice()
        );
    }

    @Override
    @Transactional
    public void deleteChild(
            Integer guardianId,
            Integer childId
    ) {

        Child child = getOwnedChild(guardianId, childId);

        childRepository.delete(child);
    }

    private Child getOwnedChild(
            Integer guardianId,
            Integer childId
    ) {

        return childRepository
                .findByIdAndGuardianId(childId, guardianId)
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.CHILD_NOT_FOUND)
                );
    }
}