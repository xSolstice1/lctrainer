import { Router } from "express";
import { z } from "zod";
import type { LLMProvider } from "../providers/LLMProvider.js";
import { buildSystemPrompt } from "../prompts/socraticSystemPrompt.js";

const guidanceRequestSchema = z.object({
  sessionId: z.string(),
  problem: z.object({
    slug: z.string(),
    title: z.string(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    tags: z.array(z.string()),
    statementHtml: z.string(),
  }),
  code: z.object({
    language: z.string(),
    code: z.string(),
    timestampMs: z.number(),
    possiblyIncomplete: z.boolean().optional(),
  }),
  userQuestion: z.string().optional(),
  modelId: z.string().optional(),
});

export function createGuidanceRouter(provider: LLMProvider): Router {
  const router = Router();

  router.post("/api/guidance/stream", async (req, res) => {
    const parsed = guidanceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid guidance request", details: parsed.error.flatten() });
      return;
    }

    const request = parsed.data;
    const systemPrompt = buildSystemPrompt(request.problem);
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

    try {
      for await (const chunk of provider.streamGuidance(request, systemPrompt, abortController.signal)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
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
