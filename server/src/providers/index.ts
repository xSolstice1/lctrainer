import type { LLMProviderId } from "@lctrainer/shared";
import type { AppConfig } from "../config/env.js";
import { BedrockProvider } from "./BedrockProvider.js";
import { OpenRouterProvider } from "./OpenRouterProvider.js";
import { LocalProvider } from "./LocalProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export type ProviderRegistry = Map<LLMProviderId, LLMProvider>;

/** Instantiates one provider per entry in config.availableProviders — "local" (Ollama) is always available; bedrock/openrouter are added only when their env vars are configured. */
export function createProviderRegistry(config: AppConfig): ProviderRegistry {
  const registry: ProviderRegistry = new Map();

  registry.set("local", new LocalProvider({ baseUrl: config.local.baseUrl, modelId: config.local.modelId }));

  if (config.availableProviders.includes("bedrock")) {
    registry.set(
      "bedrock",
      new BedrockProvider({
        region: config.aws.region,
        profile: config.aws.profile,
        modelId: config.aws.bedrockModelId,
      })
    );
  }

  if (config.availableProviders.includes("openrouter")) {
    registry.set(
      "openrouter",
      new OpenRouterProvider({
        apiKey: config.openRouter.apiKey,
        modelId: config.openRouter.modelId,
      })
    );
  }

  return registry;
}

export function defaultModelIdFor(config: AppConfig, providerId: LLMProviderId): string {
  switch (providerId) {
    case "bedrock":
      return config.aws.bedrockModelId;
    case "openrouter":
      return config.openRouter.modelId;
    case "local":
      return config.local.modelId;
  }
}

/** Providers that expose a discoverable model list via GET /api/models/:providerId. */
export function supportsModelList(providerId: LLMProviderId): boolean {
  return providerId === "local" || providerId === "bedrock";
}

export type { LLMProvider } from "./LLMProvider.js";
