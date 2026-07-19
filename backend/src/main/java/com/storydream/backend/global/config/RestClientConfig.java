package com.storydream.backend.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient aiRestClient(
            RestClient.Builder builder,
            @Value("${ai.base-url}") String baseUrl,
            @Value("${ai.read-timeout-seconds:20}") long readTimeoutSeconds
    ) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(readTimeoutSeconds));

        return builder
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }
}