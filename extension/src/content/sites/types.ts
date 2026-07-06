import type { ProblemMetadata } from "@lctrainer/shared";

export interface CodeExtractionResult {
  code: string;
  language: string;
  possiblyIncomplete: boolean;
}

/**
 * A coding-practice site this extension can run against. Each adapter owns
 * its own problem/code extraction strategy and slug-change/accepted-submission
 * detection — content.ts is written against this interface only, so it
 * doesn't need to know which site it's on.
 */
export interface SiteAdapter {
  /** Human-readable name, used only for the content script's startup log line. */
  name: string;
  extractProblem(): Promise<ProblemMetadata | null>;
  getCurrentCode(timeoutMs?: number): Promise<CodeExtractionResult>;
  /** Calls back whenever the SPA navigates to a different problem without a full page load. Returns a disposer. */
  onSlugChange(callback: (slug: string | null) => void): () => void;
  /** Calls back once per accepted submission. Returns a disposer. */
  onAccepted(callback: () => void): () => void;
}
