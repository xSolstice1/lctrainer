import { useEffect, useImperativeHandle, forwardRef } from "react";
import type { GuidanceChunk, LLMProviderId, ModelInfo, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";
import { usePanelState } from "./usePanelState.js";
import { useTheme } from "./useTheme.js";
import { usePanelLayout } from "./usePanelLayout.js";
import { HintRenderer } from "./HintRenderer.js";

export interface PanelHandle {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onServerInfoLoaded(config: ServerConfigInfo, modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>>): void;
  onServerInfoFailed(message: string): void;
}

interface PanelAppProps {
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

export const PanelApp = forwardRef<PanelHandle, PanelAppProps>(function PanelApp(
  { initialProviderId, initialModelId, onRequestHint, onProviderChange, onModelChange, onRequestServerInfo },
  ref
) {
  const [state, dispatch] = usePanelState();
  const { theme, toggleTheme } = useTheme();
  const { layout, updateLayout, startDrag, startResize } = usePanelLayout();

  useImperativeHandle(ref, () => ({
    onProblemLoaded: (problem) => dispatch({ type: "problemLoaded", problem }),
    onGuidanceChunk: (chunk) => dispatch({ type: "guidanceChunk", chunk }),
    onConnectionError: (message) => dispatch({ type: "connectionError", message }),
    onServerInfoLoaded: (config, modelsByProvider) => dispatch({ type: "serverInfoLoaded", config, modelsByProvider }),
    onServerInfoFailed: (message) => dispatch({ type: "serverInfoFailed", message }),
  }));

  useEffect(() => {
    dispatch({ type: "providerSelected", providerId: initialProviderId });
    dispatch({ type: "modelSelected", modelId: initialModelId });
    onRequestServerInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProviderChange = (providerId: string) => {
    dispatch({ type: "providerSelected", providerId });
    onProviderChange(providerId);
    onModelChange("");
  };

  const handleModelChange = (modelId: string) => {
    dispatch({ type: "modelSelected", modelId });
    onModelChange(modelId);
  };

  const handleRequest = async () => {
    const { codeCaptureIncomplete } = await onRequestHint({
      userQuestion: state.questionText.trim() || undefined,
      allowFullSolution: state.allowFullSolution || undefined,
      provider: state.selectedProviderId || undefined,
      modelId: state.selectedModelId || undefined,
    });
    dispatch({ type: "hintRequested", codeCaptureIncomplete });
  };

  const buttonLabel = state.isStreaming
    ? "Thinking..."
    : state.allowFullSolution
      ? "Get full solution"
      : state.questionText.trim()
        ? "Ask"
        : "Get a hint";

  const effectiveProviderId = state.selectedProviderId || state.serverConfig?.defaultProvider || "";
  const providers = state.serverConfig?.providers ?? [];
  const selectedProviderInfo = providers.find((p) => p.id === effectiveProviderId);
  const availableModels = (effectiveProviderId && state.modelsByProvider[effectiveProviderId as LLMProviderId]) || [];

  return (
    <div
      className={`lctrainer-panel theme-${theme}`}
      style={{
        position: "fixed",
        top: layout.top,
        right: layout.right,
        width: layout.width,
        height: layout.height,
        opacity: layout.opacity,
        pointerEvents: "auto",
      }}
    >
      <div className="panel-header" onPointerDown={startDrag}>
        <span className="panel-title">lctrainer</span>
        <div className="panel-header-actions">
          <button
            type="button"
            className="icon-button"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
        </div>
      </div>

      <div className="panel-body">
        <div className="problem-title">{state.problem ? state.problem.title : "Loading problem..."}</div>

        {providers.length > 1 && (
          <label className="model-select-label">
            Provider
            <select value={state.selectedProviderId} onChange={(e) => handleProviderChange(e.target.value)}>
              <option value="">Server default ({state.serverConfig?.defaultProvider})</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedProviderInfo?.supportsModelList && (
          <label className="model-select-label">
            Model
            {availableModels.length > 0 ? (
              <select value={state.selectedModelId} onChange={(e) => handleModelChange(e.target.value)}>
                <option value="">Server default ({selectedProviderInfo.defaultModelId})</option>
                {availableModels.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.modelName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="model-select-fallback">
                {state.serverInfoError ? "Model list unavailable" : "Loading models..."}
              </span>
            )}
          </label>
        )}

        {selectedProviderInfo && !selectedProviderInfo.supportsModelList && (
          <div className="model-select-label">
            Model
            <span className="model-select-fallback">{state.selectedModelId || selectedProviderInfo.defaultModelId}</span>
          </div>
        )}

        <textarea
          className="question-input"
          placeholder="Ask a specific question (optional) — otherwise just get a general hint"
          value={state.questionText}
          onChange={(e) => dispatch({ type: "questionTextChanged", text: e.target.value })}
          rows={2}
        />

        <div className="panel-controls-row">
          <label className="full-solution-toggle">
            <input
              type="checkbox"
              checked={state.allowFullSolution}
              onChange={(e) => dispatch({ type: "allowFullSolutionChanged", allowFullSolution: e.target.checked })}
            />
            Full solution
          </label>

          <label className="opacity-control" title="Panel opacity">
            <span>Opacity</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={layout.opacity}
              onChange={(e) => updateLayout({ opacity: Number(e.target.value) })}
            />
          </label>
        </div>

        <button onClick={handleRequest} disabled={state.isStreaming || !state.problem}>
          {buttonLabel}
        </button>

        {state.codeCaptureIncomplete && (
          <div className="incomplete-notice">
            Code capture may be incomplete (some scrolled-out lines might be missing).
          </div>
        )}
        {state.error && <div className="error-text">{state.error}</div>}
        {state.hintText && <HintRenderer text={state.hintText} />}
      </div>

      <div className="panel-footer">
        <span>Made by Vectr Labs</span>
      </div>

      <div className="resize-handle" onPointerDown={startResize} />
    </div>
  );
});
