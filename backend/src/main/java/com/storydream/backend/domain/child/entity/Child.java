package com.storydream.backend.domain.child.entity;

import com.storydream.backend.domain.guardian.entity.Guardian;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "child")
public class Child {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guardian_id", nullable = false)
    private Guardian guardian;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String[] interest;

    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate;

    @Column(name = "default_level", nullable = false)
    private Integer defaultLevel;

//    @Column(name = "use_parent_voice", nullable = false)
//    private Boolean useParentVoice;


    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public Child(
            Guardian guardian,
            String name,
            String[] interest,
            LocalDate birthDate,
            Integer defaultLevel
            // Boolean useParentVoice
    ) {
        this.guardian = guardian;
        this.name = name;
        this.interest = interest;
        this.birthDate = birthDate;
        this.defaultLevel = defaultLevel;
        // this.useParentVoice = useParentVoice;
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void updateProfile(
            String name,
            LocalDate birthDate,
            Integer defaultLevel,
            String[] interest
            // Boolean useParentVoice
    ) {
        if (name != null) {
            this.name = name;
        }

        if (birthDate != null) {
            this.birthDate = birthDate;
        }

        if (defaultLevel != null) {
            this.defaultLevel = defaultLevel;
        }

        if (interest != null) {
            this.interest = interest;
        }

//        if (useParentVoice != null) {
//            this.useParentVoice = useParentVoice;
//        }
        this.updatedAt = LocalDateTime.now();
    }
}