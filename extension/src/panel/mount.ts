import { createRoot } from "react-dom/client";
import { createElement, createRef } from "react";
import type { GuidanceChunk, HintLevel, LLMProviderId, ModelInfo, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";
import { PanelApp, type PanelHandle } from "./PanelApp.js";
import panelStyles from "./styles.css?inline";

export interface MountedPanel {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onGuidanceCancelled(): void;
  onServerInfoLoaded(config: ServerConfigInfo, modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>>): void;
  onServerInfoFailed(message: string): void;
  onProblemAccepted(): void;
  triggerHintShortcut(): void;
}

interface MountPanelOptions {
  initialProviderId: string;
  initialModelId: string;
  onRequestHint: (opts: {
    userQuestion?: string;
    hintLevel?: HintLevel;
    provider?: string;
    modelId?: string;
  }) => Promise<{ codeCaptureIncomplete: boolean; codeCaptureFailureReason?: string }>;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onRequestServerInfo: () => void;
  onCancelHint: () => void;
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
      onProviderChange: options.onProviderChange,
      onModelChange: options.onModelChange,
      onRequestServerInfo: options.onRequestServerInfo,
      onCancelHint: options.onCancelHint,
    })
  );

  return {
    onProblemLoaded: (problem) => ref.current?.onProblemLoaded(problem),
    onGuidanceChunk: (chunk) => ref.current?.onGuidanceChunk(chunk),
    onConnectionError: (message) => ref.current?.onConnectionError(message),
    onGuidanceCancelled: () => ref.current?.onGuidanceCancelled(),
    onServerInfoLoaded: (config, modelsByProvider) => ref.current?.onServerInfoLoaded(config, modelsByProvider),
    onServerInfoFailed: (message) => ref.current?.onServerInfoFailed(message),
    onProblemAccepted: () => ref.current?.onProblemAccepted(),
    triggerHintShortcut: () => ref.current?.triggerHintShortcut(),
  };
}
