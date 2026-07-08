import type { Quiz } from "../types/quiz";

type QuizResponse = {
  quizId: number;
  question: string;
  type: string;
  choices: string[];
  correctAnswer?: string;
  explanation?: string;
};

type QuizListApiResponse = {
  success: boolean;
  data: {
    quizzes: QuizResponse[];
  };
  message: string | null;
};

type QuizSubmitApiResponse = {
  success: boolean;
  data: {
    isCorrect: boolean;
    correctAnswer: string;
  };
  message: string | null;
};

type GetQuizListParams = {
  originalStoryId: number;
  partType?: string;
};

const mockQuizSets: Record<string, Quiz[]> = {
  서론: [
    {
      quizId: 1,
      question: "돌리는 처음에 어떤 기분이었을까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["속상해서 울고 있었어요.", "신나서 춤추고 있었어요."],
      correctAnswer: "속상해서 울고 있었어요.",
      explanation: "돌리는 엄마가 떠난 게 슬퍼서 엉엉 울고 있었어요.",
    },
    {
      quizId: 2,
      question: "돌리는 엄마 손을 꼭 잡았어요.",
      type: "OX",
      choices: ["O", "X"],
      correctAnswer: "O",
      explanation: "이야기에서 돌리는 엄마 손을 꼭 잡으며 마음을 달랬어요.",
    },
    {
      quizId: 3,
      question: "돌리가 한 행동으로 맞는 것은 무엇일까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["엉엉 울었어요.", "멀리 도망갔어요."],
      correctAnswer: "엉엉 울었어요.",
      explanation: "서론에서는 돌리가 울고 있는 모습이 먼저 나와요.",
    },
    {
      quizId: 4,
      question: "서론에서 돌리는 웃고 있었어요.",
      type: "OX",
      choices: ["O", "X"],
      correctAnswer: "X",
      explanation: "처음의 돌리는 웃은 것이 아니라 슬퍼서 울고 있었어요.",
    },
    {
      quizId: 5,
      question: "엄마와 돌리를 이어 주는 행동은 무엇이었을까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["손을 꼭 잡았어요.", "숨바꼭질을 했어요."],
      correctAnswer: "손을 꼭 잡았어요.",
      explanation: "돌리는 엄마 손을 꼭 잡으며 안정을 찾기 시작했어요.",
    },
  ],
  본론: [
    {
      quizId: 6,
      question: "엄마는 돌리 옆에서 어떻게 했을까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["쪼그려 앉았어요.", "멀리 서 있었어요."],
      correctAnswer: "쪼그려 앉았어요.",
      explanation: "엄마는 돌리 눈높이에 맞춰 옆에 쪼그려 앉아 주었어요.",
    },
    {
      quizId: 7,
      question: "엄마는 돌리의 젖은 앞머리를 넘겨 주었어요.",
      type: "OX",
      choices: ["O", "X"],
      correctAnswer: "O",
      explanation: "엄마는 돌리를 다정하게 돌보며 앞머리도 살며시 넘겨 주었어요.",
    },
    {
      quizId: 8,
      question: '엄마가 돌리에게 해 준 말은 무엇일까요?',
      type: "MULTIPLE_CHOICE",
      choices: ['"많이 속상했구나."', '"어서 뛰어가자."'],
      correctAnswer: '"많이 속상했구나."',
      explanation: "엄마는 돌리의 마음을 먼저 이해해 주는 말을 건넸어요.",
    },
    {
      quizId: 9,
      question: "본론에서 엄마는 돌리를 다그쳤어요.",
      type: "OX",
      choices: ["O", "X"],
      correctAnswer: "X",
      explanation: "엄마는 다그치지 않고 돌리를 따뜻하게 달래 주었어요.",
    },
    {
      quizId: 10,
      question: "엄마의 행동으로 가장 알맞은 것은 무엇일까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["돌리를 따뜻하게 달래 주었어요.", "돌리를 혼자 두고 갔어요."],
      correctAnswer: "돌리를 따뜻하게 달래 주었어요.",
      explanation: "본론에서 엄마는 공감과 위로로 돌리를 안심시켜 주었어요.",
    },
  ],
  결론: [
    {
      quizId: 11,
      question: "결론에서 돌리의 마음은 어떻게 변했을까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["조금씩 편안해졌어요.", "점점 더 무서워졌어요."],
      correctAnswer: "조금씩 편안해졌어요.",
      explanation: "엄마의 위로 덕분에 돌리의 마음은 점점 편안해졌어요.",
    },
    {
      quizId: 12,
      question: "돌리는 다시 웃을 수 있게 되었어요.",
      type: "OX",
      choices: ["O", "X"],
      correctAnswer: "O",
      explanation: "이야기의 마지막에서 돌리는 다시 환하게 웃게 되었어요.",
    },
    {
      quizId: 13,
      question: "마지막에 돌리가 할 수 있게 된 것은 무엇일까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["환하게 웃는 것", "숨는 것"],
      correctAnswer: "환하게 웃는 것",
      explanation: "결론에서는 돌리가 마음을 회복하고 다시 웃게 되는 모습이 나와요.",
    },
    {
      quizId: 14,
      question: "결론에서도 돌리는 계속 울기만 했어요.",
      type: "OX",
      choices: ["O", "X"],
      correctAnswer: "X",
      explanation: "결론의 돌리는 계속 울지 않고 다시 웃을 수 있게 되었어요.",
    },
    {
      quizId: 15,
      question: "이야기의 끝에서 가장 잘 어울리는 말은 무엇일까요?",
      type: "MULTIPLE_CHOICE",
      choices: ["마음이 편안해졌어요.", "더 크게 화를 냈어요."],
      correctAnswer: "마음이 편안해졌어요.",
      explanation: "이야기의 끝에서는 돌리의 마음이 안정되고 편안해졌어요.",
    },
  ],
};

export function getMockQuizzes(partType = "서론"): Quiz[] {
  return mockQuizSets[partType] ?? mockQuizSets.서론;
}

export async function getQuizzes({
  originalStoryId,
  partType = "서론",
}: GetQuizListParams): Promise<Quiz[]> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const searchParams = new URLSearchParams({
    originalStoryId: String(originalStoryId),
    partType,
  });

  const response = await fetch(`/api/quizzes?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("퀴즈 목록 조회 실패");
  }

  const result: QuizListApiResponse = await response.json();

  return result.data.quizzes;
}

export async function submitQuiz(
  quizId: number,
  selectedAnswer: string,
  fallbackCorrectAnswer?: string,
): Promise<{ isCorrect: boolean; correctAnswer: string }> {
  const accessToken = localStorage.getItem("accessToken");
  const readingHistoryId = localStorage.getItem("readingHistoryId");

  if (!accessToken || !readingHistoryId) {
    const correctAnswer = fallbackCorrectAnswer ?? selectedAnswer;

    return {
      isCorrect: selectedAnswer === correctAnswer,
      correctAnswer,
    };
  }

  const response = await fetch(`/api/quizzes/${quizId}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      readingHistoryId: Number(readingHistoryId),
      selectedAnswer,
    }),
  });

  if (!response.ok) {
    throw new Error("퀴즈 제출 실패");
  }

  const result: QuizSubmitApiResponse = await response.json();

  return result.data;
}
