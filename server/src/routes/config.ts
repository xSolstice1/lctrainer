import { Router } from "express";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { LLMProviderId, ProviderInfo } from "@lctrainer/shared";
import type { AppConfig } from "../config/env.js";
import type { ProviderRegistry } from "../providers/index.js";
import { defaultModelIdFor, supportsModelList } from "../providers/index.js";
import { BedrockProvider } from "../providers/BedrockProvider.js";
import { LocalProvider } from "../providers/LocalProvider.js";

function parseAwsProfiles(content: string): string[] {
  const profiles: string[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^\[profile\s+(.+?)\]$/) ?? line.match(/^\[(.+?)\]$/);
    if (m && m[1] !== "default") profiles.push(m[1]);
    else if (m && m[1] === "default") profiles.unshift("default");
  }
  return [...new Set(profiles)];
}

export function createConfigRouter(config: AppConfig, providers: ProviderRegistry): Router {
  const router = Router();

  router.get("/api/config", (_req, res) => {
    const providerInfos: ProviderInfo[] = config.availableProviders.map((id) => ({
      id,
      defaultModelId: defaultModelIdFor(config, id),
      supportsModelList: supportsModelList(id),
    }));

    res.json({
      defaultProvider: config.defaultProvider,
      providers: providerInfos,
    });
  });

  router.get("/api/models/:providerId", async (req, res) => {
    const providerId = req.params.providerId as LLMProviderId;
    const provider = providers.get(providerId);

    if (providerId === "bedrock" && provider instanceof BedrockProvider) {
      try {
        const models = await provider.listClaudeModels();
        res.json({ models });
      } catch (err: any) {
        res.status(502).json({ error: err?.message ?? "Failed to list Bedrock models" });
      }
      return;
    }

    if (providerId === "local" && provider instanceof LocalProvider) {
      try {
        const models = await provider.listModels();
        res.json({ models });
      } catch (err: any) {
        res.status(502).json({ error: err?.message ?? "Failed to list local models" });
      }
      return;
    }

    res.status(400).json({ error: `Provider "${providerId}" does not support model listing on this server` });
  });

  router.get("/api/aws-profiles", async (_req, res) => {
    try {
      const configPath = join(homedir(), ".aws", "config");
      const content = await readFile(configPath, "utf-8");
      const profiles = parseAwsProfiles(content);
      res.json({ profiles, currentProfile: config.aws.profile ?? null });
    } catch {
      res.json({ profiles: [], currentProfile: config.aws.profile ?? null });
    }
  });

  return router;
}
