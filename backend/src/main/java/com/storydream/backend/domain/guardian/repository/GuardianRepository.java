package com.storydream.backend.domain.guardian.repository;

import com.storydream.backend.domain.guardian.entity.Guardian;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GuardianRepository extends JpaRepository<Guardian, Long> {

    boolean existsByLoginId(String loginId);

    Optional<Guardian> findByLoginId(String loginId);
}