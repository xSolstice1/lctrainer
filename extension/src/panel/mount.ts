import { createRoot } from "react-dom/client";
import { createElement, createRef } from "react";
import type { BedrockModelInfo, GuidanceChunk, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";
import { PanelApp, type PanelHandle } from "./PanelApp.js";
import panelStyles from "./styles.css?inline";

export interface MountedPanel {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onServerInfoLoaded(config: ServerConfigInfo, models: BedrockModelInfo[]): void;
  onServerInfoFailed(message: string): void;
}

interface MountPanelOptions {
  initialProviderId: string;
  initialModelId: string;
  onRequestHint: (opts: {
    userQuestion?: string;
    allowFullSolution?: boolean;
    provider?: string;
    modelId?: string;
  }) => Promise<{ codeCaptureIncomplete: boolean }>;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onRequestServerInfo: () => void;
}

/** Mounts the panel into a shadow-DOM-isolated container so LeetCode's own CSS can't collide with it in either direction. */
export function mountPanel(options: MountPanelOptions): MountedPanel {
  const host = document.createElement("div");
  host.id = "lctrainer-panel-host";
  host.style.position = "fixed";
  host.style.top = "80px";
  host.style.right = "16px";
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
    })
  );

  return {
    onProblemLoaded: (problem) => ref.current?.onProblemLoaded(problem),
    onGuidanceChunk: (chunk) => ref.current?.onGuidanceChunk(chunk),
    onConnectionError: (message) => ref.current?.onConnectionError(message),
    onServerInfoLoaded: (config, models) => ref.current?.onServerInfoLoaded(config, models),
    onServerInfoFailed: (message) => ref.current?.onServerInfoFailed(message),
  };
}
