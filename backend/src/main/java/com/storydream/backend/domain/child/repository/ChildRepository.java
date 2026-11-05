package com.storydream.backend.domain.child.repository;

import com.storydream.backend.domain.child.entity.Child;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChildRepository extends JpaRepository<Child, Integer> {

    Optional<Child> findByIdAndGuardianId(Integer childId, Integer guardianId);
    List<Child> findAllByGuardianIdOrderByIdAsc(Integer guardianId);
    Optional<Child> findById(Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Child c WHERE c.id = :childId")
    Optional<Child> findByIdForUpdate(@Param("childId") Integer childId);
}
