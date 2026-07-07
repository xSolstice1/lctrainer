import type { ProblemMetadata } from "./problem.js";
import type { CodeSnapshot } from "./codeSnapshot.js";

export type LLMProviderId = "local" | "bedrock" | "openrouter";

/** Graduated hint depth: 0 = smallest nudge, 1 = Socratic hint (default), 2 = pseudocode, 3 = full solution. */
export type HintLevel = 0 | 1 | 2 | 3;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export type SubmissionErrorKind = "wrong_answer" | "runtime_error" | "time_limit_exceeded" | "other";

export interface SubmissionError {
  kind: SubmissionErrorKind;
  /** Headline text from data-e2e-locator="console-result", e.g. "Wrong Answer" */
  message: string;
  /** Scraped detail: failing input, expected/actual output, or error trace. Empty string if capture failed. */
  detail: string;
}

export interface GuidanceRequest {
  sessionId: string;
  /** Unique per hint request; echoed back on chunks/errors so a stale or superseded request can be ignored. */
  requestId: string;
  problem: ProblemMetadata;
  code: CodeSnapshot;
  userQuestion?: string;
  /** Prior turns for this problem, oldest first. Does not include the current request. */
  history?: ConversationTurn[];
  /** True when the code differs from what was sent with the last hint request for this problem. */
  codeChangedSinceLastHint?: boolean;
  /** Graduated hint depth for this request. Defaults to 1 (Socratic hint) server-side if omitted. */
  hintLevel?: HintLevel;
  /** Overrides the server's default provider for this request, if set. */
  provider?: LLMProviderId;
  /** Overrides the selected provider's default model ID for this request, if set. */
  modelId?: string;
  /** Present when the user triggered "Explain error" after a failed submission. */
  submissionError?: SubmissionError;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type GuidanceChunk =
  | { type: "token"; delta: string }
  /** A reasoning/thinking-trace token, emitted separately from the final answer by reasoning models (e.g. DeepSeek-R1). */
  | { type: "reasoning"; delta: string }
  /** usage/estimatedCostUsd are present when the provider reports token counts (Bedrock always does; OpenRouter opts in) and the model is in the pricing table. Absent for local/Ollama, which is always free. */
  | { type: "done"; usage?: TokenUsage; estimatedCostUsd?: number }
  | { type: "error"; message: string };

export interface ModelInfo {
  modelId: string;
  modelName: string;
}

export interface ProviderInfo {
  id: LLMProviderId;
  defaultModelId: string;
  /** Whether GET /api/models/:providerId returns a discoverable model list for this provider. */
  supportsModelList: boolean;
}

export interface ServerConfigInfo {
  defaultProvider: LLMProviderId;
  providers: ProviderInfo[];
}
