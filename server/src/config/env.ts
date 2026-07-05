import { z } from "zod";
import type { LLMProviderId } from "@lctrainer/shared";

const baseSchema = z.object({
  PORT: z.coerce.number().default(3001),
  LLM_PROVIDER: z.enum(["local", "bedrock", "openrouter"]).optional(),

  AWS_REGION: z.string().optional(),
  AWS_PROFILE: z.string().optional(),
  BEDROCK_MODEL_ID: z.string().optional(),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL_ID: z.string().optional(),

  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL_ID: z.string().default("qwen2.5-coder:14b"),

  ALLOWED_EXTENSION_IDS: z.string().optional(),
  DEV_ALLOW_ANY_EXTENSION_ORIGIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export interface AppConfig {
  port: number;
  defaultProvider: LLMProviderId;
  availableProviders: LLMProviderId[];
  local: {
    baseUrl: string;
    modelId: string;
  };
  aws: {
    region: string;
    profile?: string;
    bedrockModelId: string;
  };
  openRouter: {
    apiKey: string;
    modelId: string;
  };
  allowedExtensionIds: string[];
  devAllowAnyExtensionOrigin: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = baseSchema.parse(env);

  const bedrockConfigured = Boolean(parsed.AWS_REGION && parsed.BEDROCK_MODEL_ID);
  const openRouterConfigured = Boolean(parsed.OPENROUTER_API_KEY && parsed.OPENROUTER_MODEL_ID);

  const availableProviders: LLMProviderId[] = ["local"];
  if (bedrockConfigured) availableProviders.push("bedrock");
  if (openRouterConfigured) availableProviders.push("openrouter");

  const defaultProvider: LLMProviderId = parsed.LLM_PROVIDER ?? (bedrockConfigured ? "bedrock" : "local");

  if (defaultProvider === "bedrock" && !bedrockConfigured) {
    throw new Error("AWS_REGION and BEDROCK_MODEL_ID are required when LLM_PROVIDER=bedrock");
  }
  if (defaultProvider === "openrouter" && !openRouterConfigured) {
    throw new Error("OPENROUTER_API_KEY and OPENROUTER_MODEL_ID are required when LLM_PROVIDER=openrouter");
  }

  return {
    port: parsed.PORT,
    defaultProvider,
    availableProviders,
    local: {
      baseUrl: parsed.OLLAMA_BASE_URL,
      modelId: parsed.OLLAMA_MODEL_ID,
    },
    aws: {
      region: parsed.AWS_REGION ?? "",
      profile: parsed.AWS_PROFILE,
      bedrockModelId: parsed.BEDROCK_MODEL_ID ?? "",
    },
    openRouter: {
      apiKey: parsed.OPENROUTER_API_KEY ?? "",
      modelId: parsed.OPENROUTER_MODEL_ID ?? "",
    },
    allowedExtensionIds: parsed.ALLOWED_EXTENSION_IDS
      ? parsed.ALLOWED_EXTENSION_IDS.split(",").map((id) => id.trim()).filter(Boolean)
      : [],
    devAllowAnyExtensionOrigin: parsed.DEV_ALLOW_ANY_EXTENSION_ORIGIN ?? false,
  };
}
