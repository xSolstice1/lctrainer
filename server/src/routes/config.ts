import { Router } from "express";
import type { ProviderInfo } from "@lctrainer/shared";
import type { AppConfig } from "../config/env.js";
import type { ProviderRegistry } from "../providers/index.js";
import { defaultModelIdFor } from "../providers/index.js";
import { BedrockProvider } from "../providers/BedrockProvider.js";

export function createConfigRouter(config: AppConfig, providers: ProviderRegistry): Router {
  const router = Router();

  router.get("/api/config", (_req, res) => {
    const providerInfos: ProviderInfo[] = config.availableProviders.map((id) => ({
      id,
      defaultModelId: defaultModelIdFor(config, id),
    }));

    res.json({
      defaultProvider: config.defaultProvider,
      providers: providerInfos,
    });
  });

  router.get("/api/models/bedrock", async (_req, res) => {
    const provider = providers.get("bedrock");
    if (!(provider instanceof BedrockProvider)) {
      res.status(400).json({ error: "Server is not configured with a Bedrock provider (set AWS_REGION and BEDROCK_MODEL_ID)" });
      return;
    }
    try {
      const models = await provider.listClaudeModels();
      res.json({ models });
    } catch (err: any) {
      res.status(502).json({ error: err?.message ?? "Failed to list Bedrock models" });
    }
  });

  return router;
}
