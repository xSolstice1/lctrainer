export type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProblemMetadata {
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  statementHtml: string;
  /** The page URL the problem was extracted from, so history views can link back to it. */
  url: string;
}
