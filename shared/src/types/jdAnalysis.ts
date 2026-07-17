export interface JDAnalysisRequest {
  jdText: string;
  provider?: string;
  modelId?: string;
  awsProfile?: string;
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

export interface JDAnalysisResult {
  company: string;
  role: string;
  seniorityLevel: string;
  topics: JDAnalysisTopic[];
  suggestedQuestions: JDAnalysisQuestion[];
}
