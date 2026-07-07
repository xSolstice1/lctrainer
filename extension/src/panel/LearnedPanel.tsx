import { useEffect, useState } from "react";
import { getSolveHistory, setManualStatus, type ProblemRecord } from "../lib/solveHistory.js";
import { groupSolvedByPattern } from "../lib/learnedGroups.js";

export function LearnedPanel() {
  const [records, setRecords] = useState<ProblemRecord[] | null>(null);

  useEffect(() => {
    getSolveHistory().then((history) => setRecords(Object.values(history)));
  }, []);

  const handleToggle = async (record: ProblemRecord) => {
    // Cycle: auto → forced learned → forced not-learned → back to auto.
    const next =
      record.manualStatus === null ? "learned" : record.manualStatus === "learned" ? "not-learned" : null;
    await setManualStatus(record.slug, next);
    setRecords((prev) => prev?.map((r) => (r.slug === record.slug ? { ...r, manualStatus: next } : r)) ?? prev);
  };

  if (!records) return null;
  const groups = groupSolvedByPattern(records);

  if (groups.length === 0) {
    return <p className="hint">Solved problems will show up here, grouped by pattern.</p>;
  }

  return (
    <div className="learned-groups">
      {groups.map((g) => (
        <details className="learned-group" key={g.tag} open={groups.length <= 3}>
          <summary>
            {g.tag} <span className="learned-count">({g.problems.length})</span>
          </summary>
          <ul>
            {g.problems.map((p) => (
              <li key={p.slug} className={`difficulty-${p.difficulty.toLowerCase()}`}>
                <span className="learned-title">{p.title}</span>
                <span className="learned-meta">
                  {p.difficulty} · {p.hintCount} hint{p.hintCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className="icon-button learned-status-toggle"
                  title={
                    p.manualStatus === "learned"
                      ? "Manually marked learned — click to mark not learned"
                      : p.manualStatus === "not-learned"
                        ? "Manually marked not learned — click to reset to auto"
                        : "Auto-detected from acceptance — click to mark learned"
                  }
                  onClick={() => handleToggle(p)}
                >
                  {p.manualStatus === "learned" ? "✓ manual" : p.manualStatus === "not-learned" ? "✕ manual" : "auto"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
