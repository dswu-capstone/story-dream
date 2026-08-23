# =========== 1단계: 빌드 작업 =============

# Java 21 JDK가 설치된 Docker 이미지
FROM eclipse-temurin:21-jdk AS builder

# 컨테이너 내부 작업 폴더
WORKDIR /app

# 프로젝트 전체를 컨테이너 안의 /app 폴더로 복사
COPY . .

# ./gradlew 명령어를 실행할 수 있도록 gradlew 파일에 실행 권한 부여
RUN chmod +x gradlew

# 컴파일, JAR 생성
RUN ./gradlew clean bootJar --no-daemon

# ============= 2단계: 실행 ==============

# 실행만 하면 되므로 JDK가 아닌 JRE 사용
FROM eclipse-temurin:21-jre

# 컨테이너 내부 작업 폴더
WORKDIR /app

# 1단계(builder)에서 생성한 JAR만 가져오기
COPY --from=builder /app/build/libs/*.jar app.jar

# 백엔드 포트
EXPOSE 8080

# 컨테이너 시작 시 Spring Boot 실행
ENTRYPOINT ["java", "-jar", "app.jar"]