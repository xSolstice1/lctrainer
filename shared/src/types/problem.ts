export type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProblemMetadata {
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  statementHtml: string;
}
