package com.storydream.backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient aiRestClient(RestClient.Builder builder) {
        return builder
                .baseUrl("http://localhost:8000") // ai 서버 주소
                .build();
    }
}