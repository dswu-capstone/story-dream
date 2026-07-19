package com.storydream.backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * 리포트 생성은 GPT 호출 때문에 수 초가 걸린다.
 * 아이 쪽 화면(독서 종료)이 그걸 기다릴 이유가 없으므로 별도 스레드에서 처리한다.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "reportExecutor")
    public Executor reportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("report-");
        executor.initialize();
        return executor;
    }
}