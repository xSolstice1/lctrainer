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

export interface StudyPlan {
  slug: string;
  name: string;
  groups: StudyPlanGroup[];
  addedAtMs: number;
  fetchedAtMs: number;
  source?: "leetcode" | "jd-generated";
  jdSnippet?: string;
}
