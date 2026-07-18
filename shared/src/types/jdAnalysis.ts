export interface JDAnalysisRequest {
  jdText: string;
  provider?: string;
  modelId?: string;
  awsProfile?: string;
  lcQuestionCount?: number;
  interviewQuestionCount?: number;
}

export type ImportanceLevel = "high" | "medium" | "low";

export interface JDAnalysisTopic {
  name: string;
  rationale: string;
  importance: ImportanceLevel;
}

export interface JDAnalysisQuestion {
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  rationale: string;
}

export type InterviewQuestionCategory = "behavioral" | "system-design" | "technical" | "domain";

export interface JDInterviewQuestion {
  question: string;
  category: InterviewQuestionCategory;
  rationale: string;
  sampleAnswer: string;
}

export interface JDAnalysisResult {
  company: string;
  role: string;
  seniorityLevel: string;
  topics: JDAnalysisTopic[];
  suggestedQuestions: JDAnalysisQuestion[];
  interviewQuestions: JDInterviewQuestion[];
}
