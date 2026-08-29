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
