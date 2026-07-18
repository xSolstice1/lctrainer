import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { defaultModelIdFor, type ProviderRegistry } from "../providers/index.js";
import { buildInterviewerParsePrompt, parseInterviewerJson } from "../prompts/interviewerParsePrompt.js";
import { streamOpenAiCompatChat } from "../providers/openAiCompat.js";
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

const requestSchema = z.object({
  linkedInText: z.string().min(20).max(15000),
  provider: z.enum(["local", "bedrock", "openrouter"]).optional(),
  modelId: z.string().optional(),
  awsProfile: z.string().optional(),
});

async function accumulate(
  config: AppConfig,
  providerId: string,
  modelId: string,
  system: string,
  user: string
): Promise<string> {
  if (providerId === "bedrock") {
    const client = new BedrockRuntimeClient({ region: config.aws.region });
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 1024,
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
      if (decoded.type === "content_block_delta" && decoded.delta?.text) text += decoded.delta.text;
      if (decoded.type === "message_stop") break;
    }
    return text;
  }

  const url =
    providerId === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : `${config.local.baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> =
    providerId === "openrouter" ? { Authorization: `Bearer ${config.openRouter.apiKey}` } : {};

  let text = "";
  for await (const chunk of streamOpenAiCompatChat({
    url,
    headers,
    modelId,
    systemPrompt: system,
    userMessage: user,
    maxTokens: 1024,
    requestFailedPrefix: "LLM request failed",
    streamErrorPrefix: "LLM stream error",
  })) {
    if (chunk.type === "token") text += chunk.delta;
    if (chunk.type === "error") throw new Error(chunk.message);
    if (chunk.type === "done") break;
  }
  return text;
}

export function createInterviewerParseRouter(config: AppConfig, providers: ProviderRegistry): Router {
  const router = Router();

  router.post("/api/interviewer/parse", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { linkedInText, provider, modelId, awsProfile } = parsed.data;
    const effectiveProvider = provider ?? config.defaultProvider;
    const effectiveModelId = modelId || defaultModelIdFor(config, effectiveProvider);

    if (awsProfile && effectiveProvider === "bedrock") process.env.AWS_PROFILE = awsProfile;

    const { system, user } = buildInterviewerParsePrompt(linkedInText);

    try {
      const rawText = await accumulate(config, effectiveProvider, effectiveModelId, system, user);
      const result = parseInterviewerJson(rawText, linkedInText);
      res.json(result);
    } catch (err: any) {
      console.error("[interviewer/parse] error:", err?.message);
      res.status(500).json({ error: err?.message ?? "Interviewer parse failed" });
    }
  });

  return router;
}
