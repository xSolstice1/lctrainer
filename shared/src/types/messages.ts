import type { LLMProviderId, ModelInfo, GuidanceChunk, GuidanceRequest, ServerConfigInfo } from "./guidance.js";
import type { JDAnalysisResult } from "./jdAnalysis.js";
import type { InterviewerProfile } from "./interviewer.js";

/** Messages sent down the chrome.runtime.Port from content script to background worker. */
export type ContentToBackgroundMessage =
  | { type: "requestGuidance"; request: GuidanceRequest }
  | { type: "cancelGuidance"; requestId: string }
  | { type: "requestServerInfo" }
  | { type: "requestAwsProfiles" }
  | { type: "requestJDAnalysis"; requestId: string; jdText: string; provider?: string; modelId?: string; awsProfile?: string; lcQuestionCount?: number; interviewQuestionCount?: number }
  | { type: "requestInterviewerParse"; requestId: string; linkedInText: string; provider?: string; modelId?: string; awsProfile?: string }
  | { type: "ping" };

/** Messages sent down the chrome.runtime.Port from background worker to content script. */
export type BackgroundToContentMessage =
  | { type: "guidanceChunk"; requestId: string; chunk: GuidanceChunk }
  | { type: "connectionError"; requestId: string; message: string }
  | { type: "guidanceCancelled"; requestId: string }
  | { type: "serverInfo"; config: ServerConfigInfo; modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>> }
  | { type: "serverInfoError"; message: string }
  | { type: "awsProfiles"; profiles: string[]; currentProfile: string | null }
  | { type: "jdAnalysisResult"; requestId: string; result: JDAnalysisResult }
  | { type: "jdAnalysisError"; requestId: string; message: string }
  | { type: "interviewerParseResult"; requestId: string; profile: InterviewerProfile }
  | { type: "interviewerParseError"; requestId: string; message: string }
  | { type: "pong" };

export const PORT_NAME = "lctrainer-guidance-port";
