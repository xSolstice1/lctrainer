import { useEffect, useImperativeHandle, forwardRef } from "react";
import type { BedrockModelInfo, GuidanceChunk, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";
import { usePanelState } from "./usePanelState.js";

export interface PanelHandle {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onServerInfoLoaded(config: ServerConfigInfo, models: BedrockModelInfo[]): void;
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

  useImperativeHandle(ref, () => ({
    onProblemLoaded: (problem) => dispatch({ type: "problemLoaded", problem }),
    onGuidanceChunk: (chunk) => dispatch({ type: "guidanceChunk", chunk }),
    onConnectionError: (message) => dispatch({ type: "connectionError", message }),
    onServerInfoLoaded: (config, models) => dispatch({ type: "serverInfoLoaded", config, models }),
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

  return (
    <div className="lctrainer-panel">
      <h3>lctrainer</h3>
      <div>{state.problem ? state.problem.title : "Loading problem..."}</div>

      {providers.length > 1 && (
        <label className="model-select-label">
          Provider
          <select value={state.selectedProviderId} onChange={(e) => handleProviderChange(e.target.value)}>
            <option value="">
              Server default ({state.serverConfig?.defaultProvider})
            </option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
      )}

      {effectiveProviderId === "bedrock" && (
        <label className="model-select-label">
          Model
          {state.bedrockModels.length > 0 ? (
            <select value={state.selectedModelId} onChange={(e) => handleModelChange(e.target.value)}>
              <option value="">Server default ({selectedProviderInfo?.defaultModelId})</option>
              {state.bedrockModels.map((m) => (
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

      {effectiveProviderId === "local" && selectedProviderInfo && (
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

      <label className="full-solution-toggle">
        <input
          type="checkbox"
          checked={state.allowFullSolution}
          onChange={(e) => dispatch({ type: "allowFullSolutionChanged", allowFullSolution: e.target.checked })}
        />
        Give full solution (skip Socratic hints)
      </label>

      <button onClick={handleRequest} disabled={state.isStreaming || !state.problem}>
        {buttonLabel}
      </button>

      {state.codeCaptureIncomplete && (
        <div className="incomplete-notice">
          Code capture may be incomplete (some scrolled-out lines might be missing).
        </div>
      )}
      {state.error && <div className="error-text">{state.error}</div>}
      {state.hintText && <div className="hint-text">{state.hintText}</div>}
    </div>
  );
});
