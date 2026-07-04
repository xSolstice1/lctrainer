import type { ProblemMetadata } from "./problem.js";
import type { CodeSnapshot } from "./codeSnapshot.js";

export interface GuidanceRequest {
  sessionId: string;
  problem: ProblemMetadata;
  code: CodeSnapshot;
  userQuestion?: string;
  /** Overrides the server's default BEDROCK_MODEL_ID / OPENROUTER_MODEL_ID for this request, if set. */
  modelId?: string;
}

export type GuidanceChunk =
  | { type: "token"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface BedrockModelInfo {
  modelId: string;
  modelName: string;
}

export interface ServerConfigInfo {
  llmProvider: "bedrock" | "openrouter";
  defaultModelId: string;
}
