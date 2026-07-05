import type { ProblemMetadata } from "./problem.js";
import type { CodeSnapshot } from "./codeSnapshot.js";

export type LLMProviderId = "local" | "bedrock" | "openrouter";

export interface GuidanceRequest {
  sessionId: string;
  problem: ProblemMetadata;
  code: CodeSnapshot;
  userQuestion?: string;
  /** When true, the model is allowed to give a full working solution instead of a Socratic hint. Off by default. */
  allowFullSolution?: boolean;
  /** Overrides the server's default provider for this request, if set. */
  provider?: LLMProviderId;
  /** Overrides the selected provider's default model ID for this request, if set. */
  modelId?: string;
}

export type GuidanceChunk =
  | { type: "token"; delta: string }
  | { type: "done" }
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
