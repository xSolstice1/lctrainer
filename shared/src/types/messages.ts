import type { LLMProviderId, ModelInfo, GuidanceChunk, GuidanceRequest, ServerConfigInfo } from "./guidance.js";

/** Messages sent down the chrome.runtime.Port from content script to background worker. */
export type ContentToBackgroundMessage =
  | { type: "requestGuidance"; request: GuidanceRequest }
  | { type: "cancelGuidance"; requestId: string }
  | { type: "requestServerInfo" }
  | { type: "ping" };

/** Messages sent down the chrome.runtime.Port from background worker to content script. */
export type BackgroundToContentMessage =
  | { type: "guidanceChunk"; requestId: string; chunk: GuidanceChunk }
  | { type: "connectionError"; requestId: string; message: string }
  | { type: "guidanceCancelled"; requestId: string }
  | { type: "serverInfo"; config: ServerConfigInfo; modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>> }
  | { type: "serverInfoError"; message: string }
  | { type: "pong" };

export const PORT_NAME = "lctrainer-guidance-port";
