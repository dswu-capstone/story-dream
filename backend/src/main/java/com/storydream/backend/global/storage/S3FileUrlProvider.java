package com.storydream.backend.global.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class S3FileUrlProvider implements FileUrlProvider {
    // AWS SDK가 제공하는 객체(임시 URL 생성)
    // S3Config에서 @Bean으로 등록했던 객체를 Spring이 보관했다가 여기서 주입
    private final S3Presigner s3Presigner;


    @Value("${aws.s3.bucket}")
    private String bucketName;

    @Override
    public String generateUrl(String objectKey) {
        GetObjectRequest getObjectRequest =
                GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .build();

        GetObjectPresignRequest presignRequest =
                GetObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofHours(1)) // 유효시간 1시간
                        .getObjectRequest(getObjectRequest)
                        .build();

        return s3Presigner
                .presignGetObject(presignRequest)
                .url()
                .toString();
    }
}
