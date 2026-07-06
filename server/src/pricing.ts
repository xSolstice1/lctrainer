/**
 * Static USD-per-million-token pricing, keyed by a substring match against
 * the model/inference-profile ID. Best-effort — Bedrock inference profile
 * IDs and OpenRouter model IDs both vary by region/vendor prefix, so this
 * matches on the recognizable model family rather than an exact ID. Returns
 * null for unrecognized models (local/Ollama is always free and never
 * reaches this).
 */
interface Rate {
  inputPerMillion: number;
  outputPerMillion: number;
}

const RATES: { match: string; rate: Rate }[] = [
  { match: "claude-sonnet-4-5", rate: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: "claude-sonnet-4", rate: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: "claude-3-7-sonnet", rate: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: "claude-3-5-sonnet", rate: { inputPerMillion: 3, outputPerMillion: 15 } },
  { match: "claude-opus-4", rate: { inputPerMillion: 15, outputPerMillion: 75 } },
  { match: "claude-3-opus", rate: { inputPerMillion: 15, outputPerMillion: 75 } },
  { match: "claude-haiku-4-5", rate: { inputPerMillion: 1, outputPerMillion: 5 } },
  { match: "claude-3-5-haiku", rate: { inputPerMillion: 0.8, outputPerMillion: 4 } },
  { match: "claude-3-haiku", rate: { inputPerMillion: 0.25, outputPerMillion: 1.25 } },
  { match: "gpt-4o-mini", rate: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
  { match: "gpt-4o", rate: { inputPerMillion: 2.5, outputPerMillion: 10 } },
  { match: "gpt-4-turbo", rate: { inputPerMillion: 10, outputPerMillion: 30 } },
];

export function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number | null {
  const lower = modelId.toLowerCase();
  const entry = RATES.find((r) => lower.includes(r.match));
  if (!entry) return null;
  return (inputTokens * entry.rate.inputPerMillion + outputTokens * entry.rate.outputPerMillion) / 1_000_000;
}
