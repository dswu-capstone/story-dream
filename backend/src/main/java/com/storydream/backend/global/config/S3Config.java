package com.storydream.backend.global.config;
import software.amazon.awssdk.regions.Region;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {
    // S3Presigner 객체를 Bean으로 등록
    @Bean
    public S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .region(Region.AP_SOUTHEAST_2)
                .build();
    }
}
