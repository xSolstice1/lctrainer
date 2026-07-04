import type { GuidanceChunk, GuidanceRequest } from "@lctrainer/shared";

export interface LLMProvider {
  streamGuidance(
    request: GuidanceRequest,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<GuidanceChunk>;
}
