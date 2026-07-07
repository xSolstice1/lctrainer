import { useEffect, useState } from "react";
import { getSolveHistory, type ProblemRecord } from "../lib/solveHistory.js";
import { groupSolvedByPattern } from "../lib/learnedGroups.js";

export function LearnedPanel() {
  const [records, setRecords] = useState<ProblemRecord[] | null>(null);

  useEffect(() => {
    getSolveHistory().then((history) => setRecords(Object.values(history)));
  }, []);

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
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
