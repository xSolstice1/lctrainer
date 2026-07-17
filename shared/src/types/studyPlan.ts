import type { Difficulty } from "./problem.js";

export interface StudyPlanQuestionRef {
  slug: string;
  title: string;
  difficulty: Difficulty;
}

export interface StudyPlanGroup {
  /** LC groups plan questions into named subgroups ("Day 1", "Sliding Window", etc). */
  name: string;
  questions: StudyPlanQuestionRef[];
}

export type StudyPlanInterviewQuestionCategory = "behavioral" | "system-design" | "technical" | "domain";

export interface StudyPlanInterviewQuestion {
  question: string;
  category: StudyPlanInterviewQuestionCategory;
  rationale: string;
  sampleAnswer: string;
}

export interface StudyPlan {
  slug: string;
  name: string;
  groups: StudyPlanGroup[];
  addedAtMs: number;
  fetchedAtMs: number;
  source?: "leetcode" | "jd-generated";
  jdSnippet?: string;
  interviewQuestions?: StudyPlanInterviewQuestion[];
}
