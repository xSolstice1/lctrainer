import type { ConversationTurn, GuidanceChunk, GuidanceRequest } from "@lctrainer/shared";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildUserMessage(request: GuidanceRequest): string {
  const isFirstTurn = !request.history?.length;
  const statement = isFirstTurn ? stripHtml(request.problem.statementHtml) : null;

  return [
    isFirstTurn ? `Problem: ${request.problem.title} (${request.problem.difficulty})` : null,
    statement ? `Problem statement:\n${statement}` : null,
    request.codeChangedSinceLastHint
      ? "(The user has changed their code since the last hint — consider what they tried in response to it.)"
      : null,
    `Current code (${request.code.language}):\n\`\`\`${request.code.language}\n${request.code.code}\n\`\`\``,
    request.userQuestion ? `User question: ${request.userQuestion}` : "The user wants a hint on their current approach.",
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n");
}

export interface OpenAiCompatStreamParams {
  url: string;
  headers: Record<string, string>;
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  history?: ConversationTurn[];
  maxTokens?: number;
  signal?: AbortSignal;
  requestFailedPrefix: string;
  streamErrorPrefix: string;
  /** OpenRouter-specific: asks the API to include a usage object on the final SSE chunk. Ignored by servers that don't support it (Ollama). */
  includeUsage?: boolean;
}

/** Streams chat completions from any OpenAI-compatible `/chat/completions` SSE endpoint (OpenRouter, Ollama, llama.cpp server, ...). */
export async function* streamOpenAiCompatChat(params: OpenAiCompatStreamParams): AsyncGenerator<GuidanceChunk> {
  let response: Response;
  try {
    response = await fetch(params.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...params.headers },
      body: JSON.stringify({
        model: params.modelId,
        stream: true,
        max_tokens: params.maxTokens ?? 512,
        messages: [
          { role: "system", content: params.systemPrompt },
          ...(params.history ?? []),
          { role: "user", content: params.userMessage },
        ],
        ...(params.includeUsage ? { usage: { include: true } } : {}),
      }),
      signal: params.signal,
    });
  } catch (err: any) {
    yield { type: "error", message: err?.message ?? params.requestFailedPrefix };
    return;
  }

  if (!response.ok || !response.body) {
    yield { type: "error", message: `${params.requestFailedPrefix}: ${response.status} ${response.statusText}` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: { inputTokens: number; outputTokens: number } | undefined;

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
          yield { type: "done", usage };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          // Reasoning models (e.g. DeepSeek-R1 via Ollama) stream their
          // chain-of-thought in a separate `reasoning` field, not `content` —
          // surface it distinctly rather than silently dropping it.
          const reasoning = delta?.reasoning ?? delta?.reasoning_content;
          if (reasoning) {
            yield { type: "reasoning", delta: reasoning };
          }
          if (delta?.content) {
            yield { type: "token", delta: delta.content };
          }
          // OpenRouter includes this on the final chunk when usage.include was requested.
          if (parsed.usage?.prompt_tokens != null) {
            usage = { inputTokens: parsed.usage.prompt_tokens, outputTokens: parsed.usage.completion_tokens ?? 0 };
          }
        } catch {
          // ignore malformed keep-alive lines
        }
      }
    }
    yield { type: "done", usage };
  } catch (err: any) {
    yield { type: "error", message: err?.message ?? params.streamErrorPrefix };
  }
}
