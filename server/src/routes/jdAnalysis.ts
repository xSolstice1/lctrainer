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
  lcQuestionCount: z.coerce.number().int().min(5).max(50).optional().default(15),
  interviewQuestionCount: z.coerce.number().int().min(5).max(30).optional().default(12),
});

async function accumulateOpenAiCompat(
  url: string,
  headers: Record<string, string>,
  modelId: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  let text = "";
  for await (const chunk of streamOpenAiCompatChat({
    url,
    headers,
    modelId,
    systemPrompt: system,
    userMessage: user,
    maxTokens,
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
  user: string,
  maxTokens: number
): Promise<string> {
  const client = new BedrockRuntimeClient({ region: config.aws.region });
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: maxTokens,
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
  try {
    return JSON.parse(jsonText.trim()) as JDAnalysisResult;
  } catch (parseErr) {
    console.error("[jd/analyze] JSON parse failed. Raw length:", raw.length);
    console.error("[jd/analyze] Raw tail (last 500 chars):", raw.slice(-500));
    throw parseErr;
  }
}

export function createJDAnalysisRouter(config: AppConfig, providers: ProviderRegistry): Router {
  const router = Router();

  router.post("/api/jd/analyze", async (req, res) => {
    const parsed = jdAnalysisRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { jdText, provider: providerId, modelId, awsProfile, lcQuestionCount, interviewQuestionCount } = parsed.data;
    const effectiveProvider = providerId ?? config.defaultProvider;
    const effectiveModelId = modelId || defaultModelIdFor(config, effectiveProvider);
    const maxTokens = 8192;

    console.log(`[jd/analyze] provider=${effectiveProvider} model=${effectiveModelId} lcCount=${lcQuestionCount} iqCount=${interviewQuestionCount} maxTokens=${maxTokens}`);

    const { system, user } = buildJDAnalysisPrompt(jdText, lcQuestionCount, interviewQuestionCount);

    try {
      let rawText: string;

      if (effectiveProvider === "bedrock") {
        if (awsProfile) process.env.AWS_PROFILE = awsProfile;
        rawText = await accumulateBedrock(config, effectiveModelId, system, user, maxTokens);
      } else if (effectiveProvider === "openrouter") {
        rawText = await accumulateOpenAiCompat(
          "https://openrouter.ai/api/v1/chat/completions",
          { Authorization: `Bearer ${config.openRouter.apiKey}` },
          effectiveModelId,
          system,
          user,
          maxTokens
        );
      } else {
        rawText = await accumulateOpenAiCompat(
          `${config.local.baseUrl}/v1/chat/completions`,
          {},
          effectiveModelId,
          system,
          user,
          maxTokens
        );
      }

      console.log(`[jd/analyze] raw response length: ${rawText.length} chars`);
      const result = extractJson(rawText);
      console.log(`[jd/analyze] parsed ok — topics=${result.topics?.length} lcQ=${result.suggestedQuestions?.length} iqQ=${result.interviewQuestions?.length}`);
      res.json(result);
    } catch (err: any) {
      console.error("[jd/analyze] error:", err?.message);
      res.status(500).json({ error: err?.message ?? "JD analysis failed" });
    }
  });

  return router;
}
