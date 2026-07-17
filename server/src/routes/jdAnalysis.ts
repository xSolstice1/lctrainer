import { Router } from "express";
import { z } from "zod";
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { AppConfig } from "../config/env.js";
import { defaultModelIdFor, type ProviderRegistry } from "../providers/index.js";
import { buildJDAnalysisPrompt } from "../prompts/jdAnalysisPrompt.js";
import { streamOpenAiCompatChat } from "../providers/openAiCompat.js";
import type { JDAnalysisResult } from "@lctrainer/shared";

const jdAnalysisRequestSchema = z.object({
  jdText: z.string().min(50).max(20000),
  provider: z.enum(["local", "bedrock", "openrouter"]).optional(),
  modelId: z.string().optional(),
  awsProfile: z.string().optional(),
});

async function accumulateOpenAiCompat(
  url: string,
  headers: Record<string, string>,
  modelId: string,
  system: string,
  user: string
): Promise<string> {
  let text = "";
  for await (const chunk of streamOpenAiCompatChat({
    url,
    headers,
    modelId,
    systemPrompt: system,
    userMessage: user,
    maxTokens: 2048,
    requestFailedPrefix: "LLM request failed",
    streamErrorPrefix: "LLM stream error",
  })) {
    if (chunk.type === "token") text += chunk.delta;
    if (chunk.type === "error") throw new Error(chunk.message);
    if (chunk.type === "done") break;
  }
  return text;
}

async function accumulateBedrock(
  config: AppConfig,
  modelId: string,
  system: string,
  user: string
): Promise<string> {
  const client = new BedrockRuntimeClient({ region: config.aws.region });
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 2048,
  };
  const response = await client.send(
    new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    })
  );
  let text = "";
  for await (const event of response.body ?? []) {
    if (!event.chunk?.bytes) continue;
    const decoded = JSON.parse(Buffer.from(event.chunk.bytes).toString("utf-8"));
    if (decoded.type === "content_block_delta" && decoded.delta?.text) {
      text += decoded.delta.text;
    }
    if (decoded.type === "message_stop") break;
  }
  return text;
}

function extractJson(raw: string): JDAnalysisResult {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1] : raw;
  return JSON.parse(jsonText.trim()) as JDAnalysisResult;
}

export function createJDAnalysisRouter(config: AppConfig, providers: ProviderRegistry): Router {
  const router = Router();

  router.post("/api/jd/analyze", async (req, res) => {
    const parsed = jdAnalysisRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { jdText, provider: providerId, modelId, awsProfile } = parsed.data;
    const effectiveProvider = providerId ?? config.defaultProvider;
    const effectiveModelId = modelId || defaultModelIdFor(config, effectiveProvider);

    const { system, user } = buildJDAnalysisPrompt(jdText);

    try {
      let rawText: string;

      if (effectiveProvider === "bedrock") {
        if (awsProfile) process.env.AWS_PROFILE = awsProfile;
        rawText = await accumulateBedrock(config, effectiveModelId, system, user);
      } else if (effectiveProvider === "openrouter") {
        rawText = await accumulateOpenAiCompat(
          "https://openrouter.ai/api/v1/chat/completions",
          { Authorization: `Bearer ${config.openRouter.apiKey}` },
          effectiveModelId,
          system,
          user
        );
      } else {
        rawText = await accumulateOpenAiCompat(
          `${config.local.baseUrl}/v1/chat/completions`,
          {},
          effectiveModelId,
          system,
          user
        );
      }

      const result = extractJson(rawText);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "JD analysis failed" });
    }
  });

  return router;
}
