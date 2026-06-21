# Java 21을 base 이미지로 설정
FROM eclipse-temurin:21-jdk

# 컨테이너 내부 작업 폴더
# 이후 실행되는 명령어들은 기본적으로 /app 폴더 안에서 실행된다.
WORKDIR /app

# 프로젝트 전체를 컨테이너 안의 /app 폴더로 복사
COPY . .

# ./gradlew 명령어를 실행할 수 있도록 gradlew 파일에 실행 권한 부여
RUN chmod +x gradlew

# clean: 이전 빌드 결과물 삭제
# bootJar: Spring Boot 실행용 jar 파일을 생성
# --no-daemon: Gradle 데몬을 사용하지 않고 빌드
RUN ./gradlew clean bootJar --no-daemon

# 생성된 jar 파일을 app.jar로 이름으로 복사
RUN cp build/libs/*.jar app.jar

# 컨테이너 포트
EXPOSE 8080

# java -jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]