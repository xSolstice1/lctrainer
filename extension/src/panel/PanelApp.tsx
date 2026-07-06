import { useEffect, useImperativeHandle, forwardRef } from "react";
import type { GuidanceChunk, HintLevel, LLMProviderId, ModelInfo, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";
import { usePanelState } from "./usePanelState.js";
import { useTheme } from "../lib/useTheme.js";
import { usePanelLayout } from "./usePanelLayout.js";
import { HintRenderer } from "./HintRenderer.js";

const HINT_LEVEL_LABELS: Record<HintLevel, string> = {
  0: "Nudge",
  1: "Hint",
  2: "Pseudocode",
  3: "Full solution",
};

// LeetCode's own topicTags mix algorithmic patterns/techniques (what this
// trainer wants to surface) with plain data-structure tags (Array, String,
// Hash Table, ...) — highlight the former rather than calling an LLM to
// re-derive something LeetCode already tells us for free.
const PATTERN_TAGS = new Set([
  "Two Pointers",
  "Sliding Window",
  "Binary Search",
  "Dynamic Programming",
  "Backtracking",
  "Greedy",
  "Depth-First Search",
  "Breadth-First Search",
  "Union Find",
  "Divide and Conquer",
  "Bit Manipulation",
  "Topological Sort",
  "Trie",
  "Monotonic Stack",
  "Segment Tree",
  "Binary Indexed Tree",
  "Recursion",
  "Memoization",
  "Sorting",
  "Two Pass",
  "Prefix Sum",
  "Fast and Slow Pointers",
  "Line Sweep",
]);

export interface PanelHandle {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onGuidanceCancelled(): void;
  onServerInfoLoaded(config: ServerConfigInfo, modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>>): void;
  onServerInfoFailed(message: string): void;
  onProblemAccepted(): void;
}

interface PanelAppProps {
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

export const PanelApp = forwardRef<PanelHandle, PanelAppProps>(function PanelApp(
  { initialProviderId, initialModelId, onRequestHint, onProviderChange, onModelChange, onRequestServerInfo, onCancelHint },
  ref
) {
  const [state, dispatch] = usePanelState();
  const { theme, toggleTheme } = useTheme();
  const { layout, updateLayout, toggleMinimized, startDrag, startResize } = usePanelLayout();

  useImperativeHandle(ref, () => ({
    onProblemLoaded: (problem) => dispatch({ type: "problemLoaded", problem }),
    onGuidanceChunk: (chunk) => dispatch({ type: "guidanceChunk", chunk }),
    onConnectionError: (message) => dispatch({ type: "connectionError", message }),
    onGuidanceCancelled: () => dispatch({ type: "guidanceCancelled" }),
    onServerInfoLoaded: (config, modelsByProvider) => dispatch({ type: "serverInfoLoaded", config, modelsByProvider }),
    onServerInfoFailed: (message) => dispatch({ type: "serverInfoFailed", message }),
    onProblemAccepted: () => dispatch({ type: "problemAccepted" }),
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

  const submitRequest = async (userQuestion: string | undefined, hintLevel: HintLevel) => {
    const { codeCaptureIncomplete, codeCaptureFailureReason } = await onRequestHint({
      userQuestion,
      hintLevel,
      provider: state.selectedProviderId || undefined,
      modelId: state.selectedModelId || undefined,
    });
    dispatch({
      type: "hintRequested",
      codeCaptureIncomplete,
      codeCaptureFailureReason,
      questionOverride: userQuestion,
      hintLevelOverride: hintLevel,
    });
  };

  const handleRequest = () => submitRequest(state.questionText.trim() || undefined, state.hintLevel);

  // Complexity checks are an evaluation of a complete attempt, not a hint request — level 1's
  // prompt already has a dedicated branch for "evaluate what's there" that answers directly.
  const handleComplexityCheck = () =>
    submitRequest("What's the time and space complexity of my current code, and is it optimal?", 1);

  const handleReviewOptimal = () => {
    dispatch({ type: "dismissAcceptedReviewOffer" });
    submitRequest(
      "My solution was accepted. What's the optimal approach for this problem, and how does its time/space complexity compare to mine?",
      1
    );
  };

  const buttonLabel = state.isStreaming
    ? "Thinking..."
    : state.hintLevel === 3
      ? "Get full solution"
      : state.hintLevel === 2
        ? "Get pseudocode"
        : state.questionText.trim()
          ? "Ask"
          : "Get a hint";

  const effectiveProviderId = state.selectedProviderId || state.serverConfig?.defaultProvider || "";
  const providers = state.serverConfig?.providers ?? [];
  const selectedProviderInfo = providers.find((p) => p.id === effectiveProviderId);
  const availableModels = (effectiveProviderId && state.modelsByProvider[effectiveProviderId as LLMProviderId]) || [];
  const patternTags = (state.problem?.tags ?? []).filter((tag) => PATTERN_TAGS.has(tag));

  return (
    <div
      className={`lctrainer-panel theme-${theme}${layout.minimized ? " minimized" : ""}`}
      style={{
        position: "fixed",
        top: layout.top,
        left: layout.left,
        width: layout.width,
        height: layout.minimized ? undefined : layout.height,
        opacity: layout.opacity,
        pointerEvents: "auto",
      }}
    >
      <div className="panel-header" onPointerDown={startDrag}>
        <span className="panel-title">Leetcode Trainer</span>
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
          <button
            type="button"
            className="icon-button"
            title={layout.minimized ? "Expand" : "Minimize"}
            onClick={toggleMinimized}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {layout.minimized ? "▢" : "—"}
          </button>
        </div>
      </div>

      {!layout.minimized && (
        <>
          <div className="panel-controls">
            <div className="problem-title">{state.problem ? state.problem.title : "Loading problem..."}</div>

            {patternTags.length > 0 && (
              <div className="pattern-tags">
                {patternTags.map((tag) => (
                  <span className="pattern-tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

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
                <span className="model-select-fallback">
                  {state.selectedModelId || selectedProviderInfo.defaultModelId}
                </span>
              </div>
            )}

            <textarea
              className="question-input"
              placeholder="Ask a specific question (optional) — otherwise just get a general hint"
              value={state.questionText}
              onChange={(e) => dispatch({ type: "questionTextChanged", text: e.target.value })}
              rows={2}
            />

            <label className="hint-level-control" title="How much of the answer to reveal">
              <span>Depth: {HINT_LEVEL_LABELS[state.hintLevel]}</span>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={state.hintLevel}
                onChange={(e) => dispatch({ type: "hintLevelChanged", hintLevel: Number(e.target.value) as HintLevel })}
              />
            </label>

            <div className="panel-controls-row">
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

            <div className="panel-controls-row">
              <button onClick={handleRequest} disabled={state.isStreaming || !state.problem}>
                {buttonLabel}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleComplexityCheck}
                disabled={state.isStreaming || !state.problem}
                title="Ask for the time/space complexity of your current code"
              >
                Complexity?
              </button>
              {state.isStreaming && (
                <button type="button" className="cancel-button" onClick={onCancelHint}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="panel-output">
            {state.showAcceptedReviewOffer && (
              <div className="accepted-offer">
                <span>Accepted! Want to review the optimal approach?</span>
                <div className="accepted-offer-actions">
                  <button type="button" className="secondary-button" onClick={handleReviewOptimal} disabled={state.isStreaming}>
                    Review
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => dispatch({ type: "dismissAcceptedReviewOffer" })}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {state.codeCaptureIncomplete && (
              <div className="incomplete-notice">
                Code capture may be incomplete
                {state.codeCaptureFailureReason ? `: ${state.codeCaptureFailureReason}.` : "."}
              </div>
            )}
            {state.thread.map((entry, i) => (
              <div className="thread-entry" key={i}>
                {entry.question && (
                  <div className="thread-question">
                    {entry.question}
                    <span className="thread-level-tag">{HINT_LEVEL_LABELS[entry.hintLevel]}</span>
                  </div>
                )}
                {entry.error && <div className="error-text">{entry.error}</div>}
                {entry.reasoningText && (
                  <details className="reasoning-block">
                    <summary>{entry.hintText ? "Thinking" : "Thinking…"}</summary>
                    <div className="reasoning-text">{entry.reasoningText}</div>
                  </details>
                )}
                {entry.hintText && <HintRenderer text={entry.hintText} />}
              </div>
            ))}
          </div>

          <div className="panel-footer">
            <span>Made by Vectr Labs</span>
          </div>

          <div className="resize-handle resize-handle-nw" onPointerDown={(e) => startResize(e, "nw")} />
          <div className="resize-handle resize-handle-ne" onPointerDown={(e) => startResize(e, "ne")} />
          <div className="resize-handle resize-handle-sw" onPointerDown={(e) => startResize(e, "sw")} />
          <div className="resize-handle resize-handle-se" onPointerDown={(e) => startResize(e, "se")} />
        </>
      )}
    </div>
  );
});
