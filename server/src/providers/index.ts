import type { AppConfig } from "../config/env.js";
import { BedrockProvider } from "./BedrockProvider.js";
import { OpenRouterProvider } from "./OpenRouterProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export function getProvider(config: AppConfig): LLMProvider {
  if (config.llmProvider === "bedrock") {
    return new BedrockProvider({
      region: config.aws.region,
      profile: config.aws.profile,
      modelId: config.aws.bedrockModelId,
    });
  }
  return new OpenRouterProvider({
    apiKey: config.openRouter.apiKey,
    modelId: config.openRouter.modelId,
  });
}

export type { LLMProvider } from "./LLMProvider.js";
