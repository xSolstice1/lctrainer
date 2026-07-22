import type { ProblemMetadata } from "./problem.js";
import type { CodeSnapshot } from "./codeSnapshot.js";
import type { InterviewerProfile } from "./interviewer.js";

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

/** Interviewer persona seniority — scales how rigorous/probing the follow-up questions and grading are. */
export type InterviewLevel = "junior" | "mid" | "senior" | "staff" | "principal";

/** How much the interviewer pushes: patient and encouraging vs. terse and time-pressured. */
export type PressureLevel = "supportive" | "standard" | "stress";

/**
 * Interview mode's stage within a single mock-interview session for one problem:
 * "opening" — interviewer restates the problem and asks the candidate to talk through their approach before coding.
 * "grilling" — candidate clicked "I'm done"; interviewer has their code and asks follow-ups/probes edge cases.
 * "grading" — interviewer produces a final structured verdict/strengths/weaknesses/rating.
 */
export type InterviewPhase = "opening" | "grilling" | "grading";

export interface InterviewGrade {
  verdict: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  strengths: string[];
  weaknesses: string[];
  /** 1-5 rating for the attempt at the selected InterviewLevel. */
  rating: number;
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
  /** "interview" switches to the mock-interview system prompt; omitted/"learn" is the default tutoring behavior. */
  mode?: "learn" | "interview";
  /** Required when mode is "interview". */
  interviewLevel?: InterviewLevel;
  pressureLevel?: PressureLevel;
  interviewPhase?: InterviewPhase;
  /** JD-based interview: the job description text. When present alongside mode="interview", activates the JD interview prompt. */
  jd?: string;
  /** Parsed + user-confirmed interviewer persona (from LinkedIn). */
  interviewer?: InterviewerProfile;
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
