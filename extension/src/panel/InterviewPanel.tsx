import type { InterviewPhase } from "@lctrainer/shared";
import { HintRenderer } from "./HintRenderer.js";
import type { InterviewEntry } from "./usePanelState.js";

const PHASE_LABELS: Record<InterviewPhase, string> = {
  opening: "Opening",
  grilling: "Follow-up",
  grading: "Final grade",
};

interface InterviewPanelProps {
  thread: InterviewEntry[];
}

export function InterviewPanel({ thread }: InterviewPanelProps) {
  if (thread.length === 0) {
    return <p className="hint">The interviewer will restate the problem here once you start.</p>;
  }

  return (
    <div className="interview-panel">
      {thread.map((entry, i) => (
        <div className="thread-entry" key={i}>
          <div className="thread-entry-row">
            <span className="thread-question-placeholder">{PHASE_LABELS[entry.phase]}</span>
          </div>
          {entry.question && <div className="interview-candidate-turn">{entry.question}</div>}
          {entry.error && <div className="error-text">{entry.error}</div>}
          {entry.reasoningText && (
            <details className="reasoning-block">
              <summary>{entry.answerText ? "Thinking" : "Thinking…"}</summary>
              <div className="reasoning-text">{entry.reasoningText}</div>
            </details>
          )}
          {entry.answerText && <HintRenderer text={entry.answerText} />}
          {entry.estimatedCostUsd != null && (
            <div className="thread-cost" title="Estimated cost based on reported token usage">
              ~${entry.estimatedCostUsd < 0.01 ? entry.estimatedCostUsd.toFixed(4) : entry.estimatedCostUsd.toFixed(3)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
