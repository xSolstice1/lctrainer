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
  initialModelId: string;
  onRequestHint: (opts: {
    userQuestion?: string;
    modelId?: string;
  }) => Promise<{ codeCaptureIncomplete: boolean }>;
  onModelChange: (modelId: string) => void;
  onRequestServerInfo: () => void;
}

export const PanelApp = forwardRef<PanelHandle, PanelAppProps>(function PanelApp(
  { initialModelId, onRequestHint, onModelChange, onRequestServerInfo },
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
    dispatch({ type: "modelSelected", modelId: initialModelId });
    onRequestServerInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModelChange = (modelId: string) => {
    dispatch({ type: "modelSelected", modelId });
    onModelChange(modelId);
  };

  const handleRequest = async () => {
    const { codeCaptureIncomplete } = await onRequestHint({
      userQuestion: state.questionText.trim() || undefined,
      modelId: state.selectedModelId || undefined,
    });
    dispatch({ type: "hintRequested", codeCaptureIncomplete });
  };

  const buttonLabel = state.isStreaming ? "Thinking..." : state.questionText.trim() ? "Ask" : "Get a hint";

  return (
    <div className="lctrainer-panel">
      <h3>lctrainer</h3>
      <div>{state.problem ? state.problem.title : "Loading problem..."}</div>

      {state.serverConfig?.llmProvider === "bedrock" && (
        <label className="model-select-label">
          Model
          {state.bedrockModels.length > 0 ? (
            <select value={state.selectedModelId} onChange={(e) => handleModelChange(e.target.value)}>
              <option value="">Server default ({state.serverConfig.defaultModelId})</option>
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

      <textarea
        className="question-input"
        placeholder="Ask a specific question (optional) — otherwise just get a general hint"
        value={state.questionText}
        onChange={(e) => dispatch({ type: "questionTextChanged", text: e.target.value })}
        rows={2}
      />

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
