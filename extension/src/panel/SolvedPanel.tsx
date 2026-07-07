import { useEffect, useState } from "react";
import type { HintLevel } from "@lctrainer/shared";
import { getSolveHistory, setManualStatus, type ProblemRecord } from "../lib/solveHistory.js";
import { groupSolvedByPattern, sortSolvedByRecency } from "../lib/learnedGroups.js";
import { ProblemHistoryRow } from "./ProblemHistoryRow.js";

type SortMode = "pattern" | "recent";

interface SolvedPanelProps {
  currentSlug: string | undefined;
  refreshKey: number;
  onReuseQuestion: (question: string, hintLevel: HintLevel) => void;
}

export function SolvedPanel({ currentSlug, refreshKey, onReuseQuestion }: SolvedPanelProps) {
  const [records, setRecords] = useState<ProblemRecord[] | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("pattern");

  useEffect(() => {
    getSolveHistory().then((history) => setRecords(Object.values(history)));
    // Re-fetch on a new problem loading (a first-ever-seen slug isn't in
    // solveHistory yet) and on acceptance (moves the current slug's status
    // from attempted to solved without necessarily changing currentSlug).
  }, [currentSlug, refreshKey]);

  const handleToggle = async (record: ProblemRecord) => {
    // Cycle: auto → forced learned → forced not-learned → back to auto.
    const next = record.manualStatus === null ? "learned" : record.manualStatus === "learned" ? "not-learned" : null;
    await setManualStatus(record.slug, next);
    setRecords((prev) => prev?.map((r) => (r.slug === record.slug ? { ...r, manualStatus: next } : r)) ?? prev);
  };

  if (!records) return null;

  const row = (p: ProblemRecord) => (
    <ProblemHistoryRow
      key={p.slug}
      record={p}
      isCurrent={p.slug === currentSlug}
      showCode
      onReuseQuestion={onReuseQuestion}
      onToggleStatus={handleToggle}
    />
  );

  if (sortMode === "recent") {
    const solved = sortSolvedByRecency(records);
    return (
      <div className="history-list">
        <SortToggle mode={sortMode} onChange={setSortMode} />
        {solved.length === 0 ? (
          <p className="hint">Solved problems will show up here.</p>
        ) : (
          solved.map(row)
        )}
      </div>
    );
  }

  const groups = groupSolvedByPattern(records);
  return (
    <div className="history-list">
      <SortToggle mode={sortMode} onChange={setSortMode} />
      {groups.length === 0 ? (
        <p className="hint">Solved problems will show up here, grouped by pattern.</p>
      ) : (
        <div className="learned-groups">
          {groups.map((g) => (
            <details className="learned-group" key={g.tag} open={groups.length <= 3}>
              <summary>
                {g.tag} <span className="learned-count">({g.problems.length})</span>
              </summary>
              {g.problems.map(row)}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function SortToggle({ mode, onChange }: { mode: SortMode; onChange: (mode: SortMode) => void }) {
  return (
    <div className="sort-toggle">
      <button
        type="button"
        className={`sidebar-tab${mode === "pattern" ? " active" : ""}`}
        onClick={() => onChange("pattern")}
      >
        By pattern
      </button>
      <button
        type="button"
        className={`sidebar-tab${mode === "recent" ? " active" : ""}`}
        onClick={() => onChange("recent")}
      >
        Most recent
      </button>
    </div>
  );
}
