import type { GuidanceChunk, GuidanceRequest, ModelInfo } from "@lctrainer/shared";
import type { LLMProvider } from "./LLMProvider.js";
import { buildUserMessage, streamOpenAiCompatChat } from "./openAiCompat.js";

export interface LocalProviderConfig {
  baseUrl: string;
  modelId: string;
}

/** Targets Ollama's OpenAI-compatible endpoint (or any other server exposing the same `/chat/completions` shape, e.g. llama.cpp server). */
export class LocalProvider implements LLMProvider {
  constructor(private readonly config: LocalProviderConfig) {}

  /** Lists models already pulled into the local Ollama instance, via Ollama's native (non-OpenAI-compat) /api/tags endpoint. */
  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.config.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list local models: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => ({ modelId: m.name, modelName: m.name }));
  }

  async *streamGuidance(
    request: GuidanceRequest,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<GuidanceChunk> {
    yield* streamOpenAiCompatChat({
      url: `${this.config.baseUrl}/v1/chat/completions`,
      headers: {},
      modelId: request.modelId || this.config.modelId,
      systemPrompt,
      userMessage: buildUserMessage(request),
      maxTokens: request.allowFullSolution ? 1536 : 512,
      signal,
      requestFailedPrefix: `Local model request failed (is Ollama running at ${this.config.baseUrl}?)`,
      streamErrorPrefix: "Local model stream error",
    });
  }
}
