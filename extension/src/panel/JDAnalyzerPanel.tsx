import { useState } from "react";
import type { JDAnalysisResult, StudyPlan } from "@lctrainer/shared";
import { saveCustomStudyPlan } from "../lib/studyPlans.js";
import { canonicalProblemUrl } from "../lib/leetcodeUrls.js";

interface JDAnalyzerPanelProps {
  onRequestJDAnalysis: (jdText: string, lcQuestionCount?: number, interviewQuestionCount?: number) => Promise<JDAnalysisResult>;
  onPlanSaved: () => void;
}

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: "difficulty-easy",
  Medium: "difficulty-medium",
  Hard: "difficulty-hard",
};

const IMPORTANCE_CLASS: Record<string, string> = {
  high: "jd-importance-high",
  medium: "jd-importance-medium",
  low: "jd-importance-low",
};

const CATEGORY_LABEL: Record<string, string> = {
  behavioral: "Behavioral",
  "system-design": "System Design",
  technical: "Technical",
  domain: "Domain",
};

const CATEGORY_CLASS: Record<string, string> = {
  behavioral: "jd-cat-behavioral",
  "system-design": "jd-cat-system-design",
  technical: "jd-cat-technical",
  domain: "jd-cat-domain",
};

export function JDAnalyzerPanel({ onRequestJDAnalysis, onPlanSaved }: JDAnalyzerPanelProps) {
  const [jdText, setJdText] = useState("");
  const [lcCount, setLcCount] = useState(15);
  const [iqCount, setIqCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JDAnalysisResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleAnalyze = async () => {
    const text = jdText.trim();
    if (text.length < 50) {
      setError("Paste a job description (at least 50 characters).");
      return;
    }
    setError(null);
    setResult(null);
    setSavedSlug(null);
    setLoading(true);

    try {
      const data = await onRequestJDAnalysis(text, lcCount, iqCount);
      setResult(data);
      setSelected(new Set(data.suggestedQuestions.map((q) => q.slug)));
    } catch (err: any) {
      setError(err?.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const toggleQuestion = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleSavePlan = async () => {
    if (!result) return;
    const questions = result.suggestedQuestions.filter((q) => selected.has(q.slug));
    if (questions.length === 0) {
      setError("Select at least one question.");
      return;
    }

    const slug = `jd-${result.company.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const nowMs = Date.now();
    const topicGroups = new Map<string, typeof questions>();
    for (const q of questions) {
      if (!topicGroups.has(q.topic)) topicGroups.set(q.topic, []);
      topicGroups.get(q.topic)!.push(q);
    }

    const plan: StudyPlan = {
      slug,
      name: `${result.role} @ ${result.company}`,
      groups: Array.from(topicGroups.entries()).map(([topic, qs]) => ({
        name: topic,
        questions: qs.map((q) => ({ slug: q.slug, title: q.title, difficulty: q.difficulty })),
      })),
      addedAtMs: nowMs,
      fetchedAtMs: nowMs,
      source: "jd-generated",
      jdSnippet: jdText.slice(0, 300),
    };

    await saveCustomStudyPlan(plan);
    setSavedSlug(slug);
    onPlanSaved();
  };

  return (
    <div className="jd-analyzer-panel">
      <div className="jd-analyzer-intro">
        <p className="hint">Paste a job description to get role-specific LeetCode recommendations.</p>
      </div>

      <textarea
        className="jd-textarea"
        placeholder="Paste job description here..."
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        rows={6}
      />

      <div className="jd-count-controls">
        <label className="jd-count-label">
          LC problems
          <input
            type="number"
            className="jd-count-input"
            min={5}
            max={50}
            value={lcCount}
            onChange={(e) => setLcCount(Math.min(50, Math.max(5, Number(e.target.value))))}
          />
        </label>
        <label className="jd-count-label">
          Interview Qs
          <input
            type="number"
            className="jd-count-input"
            min={5}
            max={30}
            value={iqCount}
            onChange={(e) => setIqCount(Math.min(30, Math.max(5, Number(e.target.value))))}
          />
        </label>
      </div>

      <button
        type="button"
        className="primary-btn jd-analyze-btn"
        onClick={handleAnalyze}
        disabled={loading || jdText.trim().length < 50}
      >
        {loading ? "Analyzing..." : "Analyze JD"}
      </button>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="jd-result">
          <div className="jd-result-header">
            <div className="jd-role-info">
              <span className="jd-company">{result.company}</span>
              <span className="jd-role">{result.role}</span>
              {result.seniorityLevel && (
                <span className="jd-seniority">{result.seniorityLevel}</span>
              )}
            </div>
          </div>

          <div className="jd-topics">
            <div className="jd-section-title">Key topics</div>
            {result.topics.map((topic) => (
              <div key={topic.name} className={`jd-topic ${IMPORTANCE_CLASS[topic.importance] ?? ""}`}>
                <span className="jd-topic-name">{topic.name}</span>
                <span className="jd-topic-rationale">{topic.rationale}</span>
              </div>
            ))}
          </div>

          {result.interviewQuestions?.length > 0 && (
            <div className="jd-interview-questions">
              <div className="jd-section-title">Interview questions</div>
              {result.interviewQuestions.map((iq, idx) => (
                <div
                  key={idx}
                  className="jd-iq-row"
                  onClick={() => handleCopy(iq.question, idx)}
                  title="Click to copy"
                >
                  <div className="jd-iq-header">
                    <span className={`jd-iq-category ${CATEGORY_CLASS[iq.category] ?? ""}`}>
                      {CATEGORY_LABEL[iq.category] ?? iq.category}
                    </span>
                    <span className="jd-iq-copy-hint">
                      {copiedIdx === idx ? "Copied!" : "Copy"}
                    </span>
                  </div>
                  <span className="jd-iq-text">{iq.question}</span>
                  <span className="jd-iq-rationale">{iq.rationale}</span>
                </div>
              ))}
            </div>
          )}

          <div className="jd-questions">
            <div className="jd-section-title">
              LeetCode problems
              <span className="jd-selected-count">
                {selected.size}/{result.suggestedQuestions.length} selected
              </span>
            </div>
            {result.suggestedQuestions.map((q) => (
              <div
                key={q.slug}
                className={`jd-question-row${selected.has(q.slug) ? " selected" : ""}`}
                onClick={() => toggleQuestion(q.slug)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(q.slug)}
                  onChange={() => toggleQuestion(q.slug)}
                  onClick={(e) => e.stopPropagation()}
                  className="jd-question-check"
                />
                <div className="jd-question-info">
                  <a
                    href={canonicalProblemUrl(q.slug)}
                    className="jd-question-title"
                    onClick={(e) => e.stopPropagation()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {q.title}
                  </a>
                  <span className={`learned-meta ${DIFFICULTY_CLASS[q.difficulty] ?? ""}`}>
                    {q.difficulty}
                  </span>
                  <span className="jd-question-topic">{q.topic}</span>
                  <span className="jd-question-rationale">{q.rationale}</span>
                </div>
              </div>
            ))}
          </div>

          {savedSlug ? (
            <p className="jd-saved-msg">Saved to Study Plan!</p>
          ) : (
            <button
              type="button"
              className="primary-btn jd-save-btn"
              onClick={handleSavePlan}
              disabled={selected.size === 0}
            >
              Save as Study Plan ({selected.size})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
