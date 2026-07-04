import type { BedrockModelInfo, GuidanceChunk, GuidanceRequest, ServerConfigInfo } from "./guidance.js";

/** Messages sent down the chrome.runtime.Port from content script to background worker. */
export type ContentToBackgroundMessage =
  | { type: "requestGuidance"; request: GuidanceRequest }
  | { type: "requestServerInfo" }
  | { type: "ping" };

/** Messages sent down the chrome.runtime.Port from background worker to content script. */
export type BackgroundToContentMessage =
  | { type: "guidanceChunk"; chunk: GuidanceChunk }
  | { type: "connectionError"; message: string }
  | { type: "serverInfo"; config: ServerConfigInfo; models: BedrockModelInfo[] }
  | { type: "serverInfoError"; message: string }
  | { type: "pong" };

export const PORT_NAME = "lctrainer-guidance-port";
