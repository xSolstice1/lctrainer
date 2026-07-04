import { z } from "zod";

const baseSchema = z.object({
  PORT: z.coerce.number().default(3001),
  LLM_PROVIDER: z.enum(["bedrock", "openrouter"]),

  AWS_REGION: z.string().optional(),
  AWS_PROFILE: z.string().optional(),
  BEDROCK_MODEL_ID: z.string().optional(),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL_ID: z.string().optional(),

  ALLOWED_EXTENSION_IDS: z.string().optional(),
  DEV_ALLOW_ANY_EXTENSION_ORIGIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export interface AppConfig {
  port: number;
  llmProvider: "bedrock" | "openrouter";
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

  if (parsed.LLM_PROVIDER === "bedrock") {
    if (!parsed.AWS_REGION) {
      throw new Error("AWS_REGION is required when LLM_PROVIDER=bedrock");
    }
    if (!parsed.BEDROCK_MODEL_ID) {
      throw new Error("BEDROCK_MODEL_ID is required when LLM_PROVIDER=bedrock");
    }
  }

  if (parsed.LLM_PROVIDER === "openrouter") {
    if (!parsed.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter");
    }
    if (!parsed.OPENROUTER_MODEL_ID) {
      throw new Error("OPENROUTER_MODEL_ID is required when LLM_PROVIDER=openrouter");
    }
  }

  return {
    port: parsed.PORT,
    llmProvider: parsed.LLM_PROVIDER,
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
