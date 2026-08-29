export type WeeklyScore = {
  label: string;
  weekStart: string;
  weekEnd: string;
  readingCount: number;
  averageQuizScore: number | null;
};

export type ReportOverviewResponse = {
  childId: number;
  childName: string;
  periodStart: string;
  periodEnd: string;
  totalReadingCount: number;
  averageQuizScore: number | null;
  averageFocusRate: number | null;
  weeklyScores: WeeklyScore[];
  aiSummary: string | null;
  summaryStatus: string;
};

export type ReportSummary = {
  reportId: number;
  readingHistoryId: number;
  storyId: number;
  storyTitle: string;
  coverImageUrl: string | null;
  completedDate: string | null;
  averageQuizScore: number;
  endLevel: number | null;
};

export type ReportPage = {
  content: ReportSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type PartTrend = {
  partType: string;
  orderNum: number;
  level: number;
  accuracy: number;
  quizTotal: number;
  quizCorrect: number;
  distractionCount: number;
  distractionSec: number;
};

export type ReportDetailResponse = {
  reportId: number;
  readingHistoryId: number;
  storyTitle: string;
  coverImageUrl: string | null;
  childName: string;
  status: string;
  completedDate: string | null;
  totalReadingSec: number;
  averageQuizScore: number;
  totalQuizCount: number;
  correctQuizCount: number;
  startLevel: number | null;
  endLevel: number | null;
  distractionCount: number;
  distractionSec: number;
  focusRate: number | null;
  aiSummary: string | null;
  parts: PartTrend[];
};
