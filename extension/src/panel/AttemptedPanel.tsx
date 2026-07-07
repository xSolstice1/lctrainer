import { useEffect, useState } from "react";
import type { HintLevel } from "@lctrainer/shared";
import { getSolveHistory, setManualStatus, type ProblemRecord } from "../lib/solveHistory.js";
import { listAttempted } from "../lib/learnedGroups.js";
import { ProblemHistoryRow } from "./ProblemHistoryRow.js";

interface AttemptedPanelProps {
  currentSlug: string | undefined;
  refreshKey: number;
  onReuseQuestion: (question: string, hintLevel: HintLevel) => void;
}

export function AttemptedPanel({ currentSlug, refreshKey, onReuseQuestion }: AttemptedPanelProps) {
  const [records, setRecords] = useState<ProblemRecord[] | null>(null);

  useEffect(() => {
    getSolveHistory().then((history) => setRecords(Object.values(history)));
  }, [currentSlug, refreshKey]);

  const handleToggle = async (record: ProblemRecord) => {
    const next = record.manualStatus === null ? "learned" : record.manualStatus === "learned" ? "not-learned" : null;
    await setManualStatus(record.slug, next);
    setRecords((prev) => prev?.map((r) => (r.slug === record.slug ? { ...r, manualStatus: next } : r)) ?? prev);
  };

  if (!records) return null;
  const attempted = listAttempted(records);

  if (attempted.length === 0) {
    return <p className="hint">Problems you've tried but not solved yet will show up here.</p>;
  }

  return (
    <div className="history-list">
      {attempted.map((p) => (
        <ProblemHistoryRow
          key={p.slug}
          record={p}
          isCurrent={p.slug === currentSlug}
          showCode={false}
          onReuseQuestion={onReuseQuestion}
          onToggleStatus={handleToggle}
        />
      ))}
    </div>
  );
}
