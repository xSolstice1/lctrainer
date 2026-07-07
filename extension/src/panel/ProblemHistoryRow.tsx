import { useEffect, useState } from "react";
import type { HintLevel } from "@lctrainer/shared";
import { loadThread, saveThread } from "../lib/threadCache.js";
import type { ProblemRecord } from "../lib/solveHistory.js";
import { ThreadPanel } from "./ThreadPanel.js";
import type { ThreadEntry } from "./usePanelState.js";

interface ProblemHistoryRowProps {
  record: ProblemRecord;
  isCurrent: boolean;
  liveThread: ThreadEntry[];
  showCode: boolean;
  onReuseQuestion?: (question: string, hintLevel: HintLevel) => void;
  onDeleteCurrentEntry?: (index: number) => void;
  onToggleStatus: (record: ProblemRecord) => void;
}

export function ProblemHistoryRow({
  record,
  isCurrent,
  liveThread,
  showCode,
  onReuseQuestion,
  onDeleteCurrentEntry,
  onToggleStatus,
}: ProblemHistoryRowProps) {
  const [expanded, setExpanded] = useState(isCurrent);
  const [historyThread, setHistoryThread] = useState<ThreadEntry[] | null>(null);

  useEffect(() => {
    if (isCurrent) setExpanded(true);
  }, [isCurrent]);

  useEffect(() => {
    if (isCurrent || !expanded || historyThread !== null) return;
    loadThread(record.slug).then((entries) => setHistoryThread(entries ?? []));
  }, [isCurrent, expanded, historyThread, record.slug]);

  const thread = isCurrent ? liveThread : historyThread ?? [];

  const handleDeleteHistoryEntry = (index: number) => {
    const next = thread.filter((_, i) => i !== index);
    setHistoryThread(next);
    saveThread(record.slug, next, Date.now());
  };

  return (
    <div className={`history-row difficulty-${record.difficulty.toLowerCase()}${isCurrent ? " current" : ""}`}>
      <button type="button" className="history-row-summary" onClick={() => setExpanded((e) => !e)}>
        <span className="history-row-title">
          {record.title}
          {isCurrent && <span className="history-row-current-tag">current</span>}
        </span>
        <span className="learned-meta">
          {record.difficulty} · {record.hintCount} hint{record.hintCount === 1 ? "" : "s"}
        </span>
      </button>
      <button
        type="button"
        className="icon-button learned-status-toggle"
        title={
          record.manualStatus === "learned"
            ? "Manually marked solved — click to mark attempted"
            : record.manualStatus === "not-learned"
              ? "Manually marked attempted — click to reset to auto"
              : "Auto-detected — click to override"
        }
        onClick={() => onToggleStatus(record)}
      >
        {record.manualStatus === "learned" ? "✓ manual" : record.manualStatus === "not-learned" ? "✕ manual" : "auto"}
      </button>

      {expanded && (
        <div className="history-row-body">
          {showCode && record.solutionCode && (
            <div className="code-block">
              <div className="code-block-header">
                <span className="code-block-lang">{record.solutionLanguage ?? "code"}</span>
              </div>
              <pre>
                <code>{record.solutionCode}</code>
              </pre>
            </div>
          )}
          <ThreadPanel
            thread={thread}
            onReuseQuestion={onReuseQuestion ?? (() => {})}
            onDeleteEntry={isCurrent ? onDeleteCurrentEntry ?? (() => {}) : handleDeleteHistoryEntry}
          />
        </div>
      )}
    </div>
  );
}
