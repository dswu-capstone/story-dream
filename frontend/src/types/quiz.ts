export type Quiz = {
  quizId: number;
  question: string;
  type: string;
  choices: string[];
  correctAnswer?: string;
  explanation?: string;
};
