package com.storydream.backend.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

//    @Bean
//    public RestClient aiRestClient() {
//
//        SimpleClientHttpRequestFactory requestFactory =
//                new SimpleClientHttpRequestFactory();
//
//        return RestClient.builder()
//                .baseUrl("http://localhost:8000")
//                .requestFactory(requestFactory)
//                .build();
//    }
    @Bean
    public RestClient aiServerRestClient(@Value("${ai.server.base-url}") String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(60));   // LLM 호출은 넉넉하게

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }
}