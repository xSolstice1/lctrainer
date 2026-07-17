import { createRoot } from "react-dom/client";
import { createElement, createRef } from "react";
import type {
  GuidanceChunk,
  HintLevel,
  InterviewLevel,
  InterviewPhase,
  JDAnalysisResult,
  LLMProviderId,
  ModelInfo,
  PressureLevel,
  ProblemMetadata,
  ServerConfigInfo,
  SubmissionError,
} from "@lctrainer/shared";
import { PanelApp, type PanelHandle } from "./PanelApp.js";
import panelStyles from "./styles.css?inline";

export interface MountedPanel {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onGuidanceCancelled(): void;
  onInterviewChunk(chunk: GuidanceChunk): void;
  onInterviewConnectionError(message: string): void;
  onInterviewCancelled(): void;
  onServerInfoLoaded(config: ServerConfigInfo, modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>>): void;
  onServerInfoFailed(message: string): void;
  onAwsProfilesLoaded(profiles: string[], currentProfile: string | null): void;
  onProblemAccepted(): void;
  onSubmissionError(error: SubmissionError): void;
  triggerHintShortcut(): void;
  triggerErrorShortcut(): void;
}

interface MountPanelOptions {
  initialProviderId: string;
  initialModelId: string;
  onRequestHint: (opts: {
    userQuestion?: string;
    hintLevel?: HintLevel;
    provider?: string;
    modelId?: string;
    submissionError?: SubmissionError;
  }) => Promise<{ codeCaptureIncomplete: boolean; codeCaptureFailureReason?: string }>;
  onRequestInterviewTurn: (opts: {
    userQuestion?: string;
    interviewLevel: InterviewLevel;
    pressureLevel: PressureLevel;
    interviewPhase: InterviewPhase;
    provider?: string;
    modelId?: string;
  }) => Promise<{ codeCaptureIncomplete: boolean; codeCaptureFailureReason?: string }>;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onRequestServerInfo: () => void;
  onRequestAwsProfiles: () => void;
  onCancelHint: () => void;
  onRequestJDAnalysis: (jdText: string, provider?: string, modelId?: string, awsProfile?: string, lcQuestionCount?: number, interviewQuestionCount?: number) => Promise<JDAnalysisResult>;
}

/**
 * Mounts the panel into a shadow-DOM-isolated container so LeetCode's own
 * CSS can't collide with it in either direction. The host spans the full
 * viewport with pointer-events disabled so it doesn't block clicks on the
 * page underneath; only the panel itself (positioned inside the shadow
 * root) re-enables pointer events.
 */
export function mountPanel(options: MountPanelOptions): MountedPanel {
  const host = document.createElement("div");
  host.id = "lctrainer-panel-host";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.pointerEvents = "none";
  host.style.zIndex = "2147483647";
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = panelStyles;
  shadowRoot.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  shadowRoot.appendChild(mountPoint);

  const ref = createRef<PanelHandle>();
  const root = createRoot(mountPoint);
  root.render(
    createElement(PanelApp, {
      ref,
      initialProviderId: options.initialProviderId,
      initialModelId: options.initialModelId,
      onRequestHint: options.onRequestHint,
      onRequestInterviewTurn: options.onRequestInterviewTurn,
      onProviderChange: options.onProviderChange,
      onModelChange: options.onModelChange,
      onRequestServerInfo: options.onRequestServerInfo,
      onRequestAwsProfiles: options.onRequestAwsProfiles,
      onCancelHint: options.onCancelHint,
      onRequestJDAnalysis: options.onRequestJDAnalysis,
    })
  );

  return {
    onProblemLoaded: (problem) => ref.current?.onProblemLoaded(problem),
    onGuidanceChunk: (chunk) => ref.current?.onGuidanceChunk(chunk),
    onConnectionError: (message) => ref.current?.onConnectionError(message),
    onGuidanceCancelled: () => ref.current?.onGuidanceCancelled(),
    onInterviewChunk: (chunk) => ref.current?.onInterviewChunk(chunk),
    onInterviewConnectionError: (message) => ref.current?.onInterviewConnectionError(message),
    onInterviewCancelled: () => ref.current?.onInterviewCancelled(),
    onServerInfoLoaded: (config, modelsByProvider) => ref.current?.onServerInfoLoaded(config, modelsByProvider),
    onServerInfoFailed: (message) => ref.current?.onServerInfoFailed(message),
    onAwsProfilesLoaded: (profiles, currentProfile) => ref.current?.onAwsProfilesLoaded(profiles, currentProfile),
    onProblemAccepted: () => ref.current?.onProblemAccepted(),
    onSubmissionError: (error) => ref.current?.onSubmissionError(error),
    triggerHintShortcut: () => ref.current?.triggerHintShortcut(),
    triggerErrorShortcut: () => ref.current?.triggerErrorShortcut(),
  };
}
