import type { HintLevel } from "@lctrainer/shared";
import { HintRenderer } from "./HintRenderer.js";
import type { ThreadEntry } from "./usePanelState.js";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const HINT_LEVEL_LABELS: Record<HintLevel, string> = {
  0: "Nudge",
  1: "Hint",
  2: "Pseudocode",
  3: "Full solution",
};

interface ThreadPanelProps {
  thread: ThreadEntry[];
  onReuseQuestion: (question: string, hintLevel: HintLevel) => void;
  onDeleteEntry: (index: number) => void;
}

export function ThreadPanel({ thread, onReuseQuestion, onDeleteEntry }: ThreadPanelProps) {
  if (thread.length === 0) {
    return <p className="hint">No questions asked yet for this problem.</p>;
  }

  return (
    <div className="thread-panel">
      {thread.map((entry, i) => (
        <div className="thread-entry" key={i}>
          <div className="thread-entry-row">
            {entry.question ? (
              <button
                type="button"
                className="thread-question"
                onClick={() => onReuseQuestion(entry.question, entry.hintLevel)}
                title="Reuse this question"
              >
                {entry.question}
                <span className="thread-level-tag">{HINT_LEVEL_LABELS[entry.hintLevel]}</span>
              </button>
            ) : (
              <span className="thread-question-placeholder">General hint</span>
            )}
            <button
              type="button"
              className="icon-button thread-delete"
              title="Remove this entry"
              onClick={() => onDeleteEntry(i)}
            >
              ✕
            </button>
          </div>
          {entry.error && <div className="error-text">{entry.error}</div>}
          {entry.reasoningText && (
            <details className="reasoning-block">
              <summary>{entry.hintText ? "Thinking" : "Thinking…"}</summary>
              <div className="reasoning-text">{entry.reasoningText}</div>
            </details>
          )}
          {entry.hintText && <HintRenderer text={entry.hintText} />}
          <div className="thread-meta">
            {entry.timestamp > 0 && <span className="thread-time">{formatTime(entry.timestamp)}</span>}
            {entry.estimatedCostUsd != null && (
              <span className="thread-cost" title="Estimated cost based on reported token usage">
                ~${entry.estimatedCostUsd < 0.01 ? entry.estimatedCostUsd.toFixed(4) : entry.estimatedCostUsd.toFixed(3)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
