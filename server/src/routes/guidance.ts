import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { defaultModelIdFor, type ProviderRegistry } from "../providers/index.js";
import { buildSystemPrompt } from "../prompts/socraticSystemPrompt.js";
import { buildInterviewSystemPrompt } from "../prompts/interviewSystemPrompt.js";
import { buildJDInterviewSystemPrompt } from "../prompts/jdInterviewSystemPrompt.js";
import { estimateCostUsd } from "../pricing.js";

const guidanceRequestSchema = z.object({
  sessionId: z.string(),
  requestId: z.string(),
  problem: z.object({
    slug: z.string(),
    title: z.string(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    tags: z.array(z.string()),
    statementHtml: z.string(),
    url: z.string().optional().default(""),
  }),
  code: z.object({
    language: z.string(),
    code: z.string(),
    timestampMs: z.number(),
    possiblyIncomplete: z.boolean().optional(),
  }),
  userQuestion: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
  codeChangedSinceLastHint: z.boolean().optional(),
  hintLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  provider: z.enum(["local", "bedrock", "openrouter"]).optional(),
  modelId: z.string().optional(),
  awsProfile: z.string().optional(),
  submissionError: z.object({
    kind: z.enum(["wrong_answer", "runtime_error", "time_limit_exceeded", "other"]),
    message: z.string(),
    detail: z.string(),
  }).optional(),
  mode: z.enum(["learn", "interview"]).optional(),
  interviewLevel: z.enum(["junior", "mid", "senior", "staff", "principal"]).optional(),
  pressureLevel: z.enum(["supportive", "standard", "stress"]).optional(),
  interviewPhase: z.enum(["opening", "grilling", "grading"]).optional(),
  jd: z.string().max(20000).optional(),
  interviewer: z.object({
    name: z.string(),
    title: z.string(),
    company: z.string(),
    yearsOfExperience: z.number(),
    technicalAreas: z.array(z.string()),
    inferredStyle: z.string(),
    rawLinkedInText: z.string(),
  }).optional(),
  lcProblems: z.array(z.string()).max(5).optional(),
});

export function createGuidanceRouter(config: AppConfig, providers: ProviderRegistry): Router {
  const router = Router();

  router.post("/api/guidance/stream", async (req, res) => {
    const parsed = guidanceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid guidance request", details: parsed.error.flatten() });
      return;
    }

    const request = parsed.data;
    const providerId = request.provider ?? config.defaultProvider;
    const provider = providers.get(providerId);
    if (!provider) {
      res.status(400).json({ error: `Provider "${providerId}" is not configured on this server` });
      return;
    }

    if (request.awsProfile && providerId === "bedrock") {
      process.env.AWS_PROFILE = request.awsProfile;
    }

    const systemPrompt =
      request.mode === "interview" && request.jd && request.interviewer
        ? buildJDInterviewSystemPrompt(
            request.jd,
            request.interviewer,
            request.lcProblems ?? [],
            request.interviewPhase ?? "opening"
          )
        : request.mode === "interview"
        ? buildInterviewSystemPrompt(
            request.problem,
            request.interviewPhase ?? "opening",
            request.interviewLevel ?? "mid",
            request.pressureLevel ?? "standard"
          )
        : buildSystemPrompt(request.problem, request.hintLevel, request.submissionError);
    const abortController = new AbortController();
    // Listen on the response (not the request) — express.json() finishes
    // reading/parsing the request body before this handler runs, which
    // fires req's "close" event immediately even though the client is
    // still connected and waiting for the streamed response.
    res.on("close", () => abortController.abort());

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const effectiveModelId = request.modelId || defaultModelIdFor(config, providerId);

    try {
      for await (const chunk of provider.streamGuidance(request, systemPrompt, abortController.signal)) {
        if (chunk.type === "done" && chunk.usage) {
          const cost = estimateCostUsd(effectiveModelId, chunk.usage.inputTokens, chunk.usage.outputTokens);
          res.write(`data: ${JSON.stringify({ ...chunk, estimatedCostUsd: cost ?? undefined })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        if (chunk.type === "done" || chunk.type === "error") break;
      }
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", message: err?.message ?? "Unknown error" })}\n\n`);
    } finally {
      res.end();
    }
  });

  return router;
}
