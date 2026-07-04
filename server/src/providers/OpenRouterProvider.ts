import type { GuidanceChunk, GuidanceRequest } from "@lctrainer/shared";
import type { LLMProvider } from "./LLMProvider.js";

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
    const userMessage = [
      `Problem: ${request.problem.title} (${request.problem.difficulty})`,
      `Current code (${request.code.language}):\n\`\`\`${request.code.language}\n${request.code.code}\n\`\`\``,
      request.userQuestion ? `User question: ${request.userQuestion}` : "The user wants a hint on their current approach.",
    ].join("\n\n");

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.modelId,
          stream: true,
          max_tokens: 512,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
        signal,
      });
    } catch (err: any) {
      yield { type: "error", message: err?.message ?? "OpenRouter request failed" };
      return;
    }

    if (!response.ok || !response.body) {
      yield { type: "error", message: `OpenRouter request failed: ${response.status} ${response.statusText}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.startsWith("data:")) continue;

          const data = line.slice("data:".length).trim();
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: "token", delta };
            }
          } catch {
            // ignore malformed keep-alive lines
          }
        }
      }
      yield { type: "done" };
    } catch (err: any) {
      yield { type: "error", message: err?.message ?? "OpenRouter stream error" };
    }
  }
}
