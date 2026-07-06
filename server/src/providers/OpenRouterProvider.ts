import type { GuidanceChunk, GuidanceRequest } from "@lctrainer/shared";
import type { LLMProvider } from "./LLMProvider.js";
import { buildUserMessage, streamOpenAiCompatChat } from "./openAiCompat.js";

export interface OpenRouterProviderConfig {
  apiKey: string;
  modelId: string;
}

export class OpenRouterProvider implements LLMProvider {
  constructor(private readonly config: OpenRouterProviderConfig) {}

  async *streamGuidance(
    request: GuidanceRequest,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<GuidanceChunk> {
    yield* streamOpenAiCompatChat({
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      modelId: request.modelId || this.config.modelId,
      systemPrompt,
      userMessage: buildUserMessage(request),
      history: request.history,
      maxTokens: request.allowFullSolution ? 1536 : 512,
      signal,
      requestFailedPrefix: "OpenRouter request failed",
      streamErrorPrefix: "OpenRouter stream error",
    });
  }
}
