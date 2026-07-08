import { useEffect, useState } from "react";
import type { StudyPlan } from "@lctrainer/shared";
import { getSolveHistory } from "../lib/solveHistory.js";
import { isLearned } from "../lib/learnedGroups.js";
import { addStudyPlan, refreshStudyPlan, removeStudyPlan, getStudyPlans } from "../lib/studyPlans.js";
import { canonicalProblemUrl, parseStudyPlanSlug } from "../lib/leetcodeUrls.js";
import { STORAGE_KEY_STUDY_PLAN_EXPANDED } from "../lib/constants.js";

interface StudyPlanShortcut {
  label: string;
  slug: string;
}

const SHORTCUTS: StudyPlanShortcut[] = [
  { label: "LeetCode 75", slug: "leetcode-75" },
  { label: "Top Interview 150", slug: "top-interview-150" },
  { label: "SQL 50", slug: "top-sql-50" },
  { label: "DP 25", slug: "dynamic-programming" },
];

interface StudyPlanPanelProps {
  currentSlug: string | undefined;
  refreshKey: number;
  onPlansChanged: () => void;
}

export function StudyPlanPanel({ currentSlug, refreshKey, onPlansChanged }: StudyPlanPanelProps) {
  const [plans, setPlans] = useState<Record<string, StudyPlan> | null>(null);
  const [solvedSlugs, setSolvedSlugs] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    getStudyPlans().then(setPlans);
    getSolveHistory().then((history) => {
      setSolvedSlugs(new Set(Object.values(history).filter(isLearned).map((r) => r.slug)));
    });
  }, [refreshKey]);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_STUDY_PLAN_EXPANDED).then((stored) => {
      setExpanded(stored[STORAGE_KEY_STUDY_PLAN_EXPANDED] ?? {});
    });
  }, []);

  const toggleExpanded = (slug: string, open: boolean) => {
    setExpanded((prev) => {
      const next = { ...prev, [slug]: open };
      chrome.storage.local.set({ [STORAGE_KEY_STUDY_PLAN_EXPANDED]: next });
      return next;
    });
  };

  const handleAdd = async (slug: string) => {
    setError(null);
    setBusySlug(slug);
    const plan = await addStudyPlan(slug);
    setBusySlug(null);
    if (!plan) {
      setError(`Couldn't load a study plan for "${slug}".`);
      return;
    }
    setPlans((prev) => ({ ...prev, [plan.slug]: plan }));
    onPlansChanged();
  };

  const handleAddCustom = () => {
    const slug = parseStudyPlanSlug(customInput);
    if (!slug) {
      setError("Paste a leetcode.com/studyplan/... URL or a plan slug.");
      return;
    }
    setCustomInput("");
    handleAdd(slug);
  };

  const handleRefresh = async (slug: string) => {
    setBusySlug(slug);
    const plan = await refreshStudyPlan(slug);
    setBusySlug(null);
    if (plan) {
      setPlans((prev) => ({ ...prev, [plan.slug]: plan }));
      onPlansChanged();
    }
  };

  const handleRemove = async (slug: string) => {
    await removeStudyPlan(slug);
    setPlans((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    onPlansChanged();
  };

  if (!plans || !expanded) return null;

  const addedPlans = Object.values(plans).sort((a, b) => b.addedAtMs - a.addedAtMs);
  const addedSlugs = new Set(addedPlans.map((p) => p.slug));

  return (
    <div className="study-plan-panel">
      <div className="study-plan-shortcuts">
        {SHORTCUTS.filter((s) => !addedSlugs.has(s.slug)).map((s) => (
          <button
            key={s.slug}
            type="button"
            className="secondary-button study-plan-shortcut"
            onClick={() => handleAdd(s.slug)}
            disabled={busySlug === s.slug}
          >
            {busySlug === s.slug ? "Adding..." : `+ ${s.label}`}
          </button>
        ))}
      </div>

      <div className="study-plan-add-custom">
        <input
          type="text"
          className="study-plan-input"
          placeholder="Paste a study plan URL or slug"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
        />
        <button type="button" className="secondary-button" onClick={handleAddCustom} disabled={!customInput.trim()}>
          Add
        </button>
      </div>

      {error && <p className="error-text study-plan-error">{error}</p>}

      {addedPlans.length === 0 ? (
        <p className="hint">Add a study plan above to track your progress through it.</p>
      ) : (
        <div className="study-plan-list">
          {addedPlans.map((plan) => {
            const questions = plan.groups.flatMap((g) => g.questions);
            const solvedCount = questions.filter((q) => solvedSlugs.has(q.slug)).length;
            const isOpen = expanded[plan.slug] ?? addedPlans.length <= 2;
            return (
              <details
                className="study-plan"
                key={plan.slug}
                open={isOpen}
                onToggle={(e) => toggleExpanded(plan.slug, e.currentTarget.open)}
              >
                <summary className="study-plan-summary">
                  <span className="study-plan-name">{plan.name}</span>
                  <span className="learned-meta">
                    {solvedCount}/{questions.length} solved
                  </span>
                </summary>
                <div className="study-plan-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title="Refresh from LeetCode"
                    onClick={() => handleRefresh(plan.slug)}
                    disabled={busySlug === plan.slug}
                  >
                    ↻
                  </button>
                  <button type="button" className="icon-button" title="Remove plan" onClick={() => handleRemove(plan.slug)}>
                    ✕
                  </button>
                </div>
                {plan.groups.map((group) => (
                  <div className="study-plan-group" key={group.name}>
                    <div className="study-plan-group-name">{group.name}</div>
                    {group.questions.map((q) => (
                      <button
                        key={q.slug}
                        type="button"
                        className={`study-plan-row difficulty-${q.difficulty.toLowerCase()}${q.slug === currentSlug ? " current" : ""}`}
                        onClick={() => {
                          window.location.href = canonicalProblemUrl(q.slug);
                        }}
                      >
                        <span className="study-plan-row-title">
                          {solvedSlugs.has(q.slug) ? "✓ " : ""}
                          {q.title}
                        </span>
                        <span className="learned-meta">{q.difficulty}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
