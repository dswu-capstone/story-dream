package com.storydream.backend.domain.guardian.repository;

import com.storydream.backend.domain.guardian.entity.SocialAccount;
import com.storydream.backend.domain.guardian.entity.SocialProvider;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, Integer> {

    @EntityGraph(attributePaths = "guardian")
    Optional<SocialAccount> findByProviderAndProviderId(SocialProvider provider, String providerId);
}
