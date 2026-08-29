package com.storydream.backend.domain.child.repository;

import com.storydream.backend.domain.child.entity.Child;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChildRepository extends JpaRepository<Child, Integer> {

    Optional<Child> findByIdAndGuardianId(Integer childId, Integer guardianId);
    List<Child> findAllByGuardianIdOrderByIdAsc(Integer guardianId);
    Optional<Child> findById(Integer id);
}