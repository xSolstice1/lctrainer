import type { BedrockModelInfo, GuidanceChunk, GuidanceRequest, ServerConfigInfo } from "./guidance.js";

/** Messages sent down the chrome.runtime.Port from content script to background worker. */
export type ContentToBackgroundMessage =
  | { type: "requestGuidance"; request: GuidanceRequest }
  | { type: "requestServerInfo" };

/** Messages sent down the chrome.runtime.Port from background worker to content script. */
export type BackgroundToContentMessage =
  | { type: "guidanceChunk"; chunk: GuidanceChunk }
  | { type: "connectionError"; message: string }
  | { type: "serverInfo"; config: ServerConfigInfo; models: BedrockModelInfo[] }
  | { type: "serverInfoError"; message: string };

export const PORT_NAME = "lctrainer-guidance-port";
