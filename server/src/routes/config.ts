import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import type { LLMProvider } from "../providers/LLMProvider.js";
import { BedrockProvider } from "../providers/BedrockProvider.js";

export function createConfigRouter(config: AppConfig, provider: LLMProvider): Router {
  const router = Router();

  router.get("/api/config", (_req, res) => {
    res.json({
      llmProvider: config.llmProvider,
      defaultModelId: config.llmProvider === "bedrock" ? config.aws.bedrockModelId : config.openRouter.modelId,
    });
  });

  router.get("/api/models/bedrock", async (_req, res) => {
    if (!(provider instanceof BedrockProvider)) {
      res.status(400).json({ error: "Server is not configured with LLM_PROVIDER=bedrock" });
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
