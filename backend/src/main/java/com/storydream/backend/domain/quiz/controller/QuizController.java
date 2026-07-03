package com.storydream.backend.domain.quiz.controller;

import com.storydream.backend.domain.quiz.dto.QuizListResponse;
import com.storydream.backend.domain.quiz.dto.QuizSubmitRequest;
import com.storydream.backend.domain.quiz.dto.QuizSubmitResponse;
import com.storydream.backend.domain.quiz.service.QuizService;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/quizzes")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Quiz", description = "퀴즈 관련 API")
public class QuizController {

    private final QuizService quizService;

    @Operation(
            summary = "파트별 퀴즈 목록 조회",
            description = """
                    선택한 동화와 문단에 해당하는 퀴즈 목록을 조회합니다.
                    
                    - originalStoryId : 퀴즈를 조회할 원본 동화 ID
                    - partType : 퀴즈를 조회할 문단 타입
                    
                    퀴즈는 order_num 오름차순으로 반환됩니다.
                    """
    )
    @GetMapping
    public ApiResponse<QuizListResponse> getQuizzes(
            @Parameter(
                    description = "원본 동화 ID",
                    example = "1",
                    required = true
            )
            @RequestParam Integer originalStoryId,

            @Parameter(
                    description = "퀴즈를 조회할 문단 타입",
                    example = "서론",
                    required = true
            )
            @RequestParam String partType
    ) {
        QuizListResponse response =
                quizService.getQuizzes(originalStoryId, partType);

        return ApiResponse.success(response);
    }


    @Operation(
            summary = "퀴즈 정답 제출",
            description = """
                    사용자가 선택한 퀴즈 답안을 제출합니다.
                    
                    - quizId : 제출할 퀴즈 ID
                    - readingHistoryId : 동화 시작 API에서 반환된 독서 기록 ID
                    - selectedAnswer : 사용자가 선택한 답안
                    
                    서버에서 정답 여부를 판별한 후 quiz_result에 결과를 저장하고,
                    정답 여부와 실제 정답을 반환합니다.
                    """
    )
    @PostMapping("/{quizId}/submit")
    public ApiResponse<QuizSubmitResponse> submitQuiz(

            @Parameter(
                    description = "제출할 퀴즈 ID",
                    example = "1"
            )
            @PathVariable Integer quizId,

            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "퀴즈 정답 제출 요청",
                    required = true
            )
            @Valid @RequestBody QuizSubmitRequest request
    ) {
        return ApiResponse.success(
                quizService.submitQuiz(
                        quizId,
                        request
                )
        );
    }
}