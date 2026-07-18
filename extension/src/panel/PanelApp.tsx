import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import type {
  GuidanceChunk,
  HintLevel,
  InterviewerProfile,
  InterviewLevel,
  InterviewPhase,
  JDAnalysisResult,
  LLMProviderId,
  ModelInfo,
  PressureLevel,
  ProblemMetadata,
  ServerConfigInfo,
  SubmissionError,
} from "@lctrainer/shared";
import { usePanelState } from "./usePanelState.js";
import { useTheme } from "../lib/useTheme.js";
import { usePanelLayout } from "./usePanelLayout.js";
import { Sidebar } from "./Sidebar.js";
import { SolvedPanel } from "./SolvedPanel.js";
import { AttemptedPanel } from "./AttemptedPanel.js";
import { StudyPlanPanel } from "./StudyPlanPanel.js";
import { JDAnalyzerPanel } from "./JDAnalyzerPanel.js";
import { ThreadPanel } from "./ThreadPanel.js";
import { InterviewPanel } from "./InterviewPanel.js";
import { loadThread, saveThread } from "../lib/threadCache.js";
import { STORAGE_KEY_AWS_PROFILE, STORAGE_KEY_JD_INTERVIEW_HISTORY, STORAGE_KEY_JD_INTERVIEW_SESSION } from "../lib/constants.js";
import { PATTERN_TAGS } from "../lib/patternTags.js";
import { useStudyPlans } from "../lib/useStudyPlans.js";
import { findPlanContext } from "../lib/studyPlans.js";
import { canonicalProblemUrl } from "../lib/leetcodeUrls.js";

const HINT_LEVEL_LABELS: Record<HintLevel, string> = {
  0: "Nudge",
  1: "Hint",
  2: "Pseudocode",
  3: "Full solution",
};

const INTERVIEW_LEVEL_LABELS: Record<InterviewLevel, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal (L8)",
};

const PRESSURE_LEVEL_LABELS: Record<PressureLevel, string> = {
  supportive: "Supportive",
  standard: "Standard",
  stress: "Stress",
};

const HINT_LEVEL_DESCRIPTIONS: Record<HintLevel, string> = {
  0: "One sentence — a concept or question to point you in the right direction. No code.",
  1: "A guiding question or observation about your approach. Still no code.",
  2: "A step-by-step pseudocode outline you can implement from. No runnable code.",
  3: "A complete working solution with explanation. Use sparingly.",
};

const TOOLTIP_WIDTH = 160;
const TOOLTIP_PADDING = 8;

function HintLevelPicker({ value, onChange }: { value: HintLevel; onChange: (l: HintLevel) => void }) {
  const [tooltipStyles, setTooltipStyles] = useState<Record<number, { left: number; arrowLeft: number }>>({});
  const wrapperRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (level: number) => {
    const wrapper = wrapperRefs.current[level];
    const container = containerRef.current;
    if (!wrapper || !container) return;

    const panelEl = container.closest(".lctrainer-panel") ?? container;
    const panelRect = panelEl.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    const dotCentreInPanel = wrapperRect.left + wrapperRect.width / 2 - panelRect.left;
    const idealLeft = dotCentreInPanel - TOOLTIP_WIDTH / 2;
    const clampedLeft = Math.max(TOOLTIP_PADDING, Math.min(idealLeft, panelRect.width - TOOLTIP_WIDTH - TOOLTIP_PADDING));
    const wrapperLeftInPanel = wrapperRect.left - panelRect.left;
    const tooltipLeftRelWrapper = clampedLeft - wrapperLeftInPanel;
    const arrowLeft = dotCentreInPanel - clampedLeft;

    setTooltipStyles((prev) => ({ ...prev, [level]: { left: tooltipLeftRelWrapper, arrowLeft } }));
  };

  return (
    <div className="hint-level-steps" ref={containerRef}>
      {([0, 1, 2, 3] as HintLevel[]).map((level, i) => {
        const ts = tooltipStyles[level];
        return (
          <div
            key={level}
            className="hint-level-step-wrapper"
            ref={(el) => { wrapperRefs.current[level] = el; }}
            onMouseLeave={() => setTooltipStyles((prev) => { const n = { ...prev }; delete n[level]; return n; })}
          >
            {i > 0 && (
              <div className={`hint-level-connector${value >= level ? " filled" : ""}`} />
            )}
            <button
              type="button"
              className={`hint-level-step${value === level ? " active" : ""}${value > level ? " passed" : ""}`}
              onClick={() => onChange(level)}
              onMouseEnter={() => handleMouseEnter(level)}
            >
              <span className="hint-level-dot" />
            </button>
            {ts && (
              <div
                className="hint-level-tooltip hint-level-tooltip-visible"
                style={{ left: ts.left, right: "auto" }}
              >
                <strong>{HINT_LEVEL_LABELS[level]}</strong>
                <span>{HINT_LEVEL_DESCRIPTIONS[level]}</span>
                <span className="hint-level-tooltip-arrow" style={{ left: ts.arrowLeft }} />
              </div>
            )}
            <span className="hint-level-step-label">{HINT_LEVEL_LABELS[level]}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface PanelHandle {
  onProblemLoaded(problem: ProblemMetadata | null): void;
  onGuidanceChunk(chunk: GuidanceChunk): void;
  onConnectionError(message: string): void;
  onGuidanceCancelled(): void;
  onInterviewChunk(chunk: GuidanceChunk): void;
  onInterviewConnectionError(message: string): void;
  onInterviewCancelled(): void;
  onServerInfoLoaded(config: ServerConfigInfo, modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>>): void;
  onServerInfoFailed(message: string): void;
  onAwsProfilesLoaded(profiles: string[], currentProfile: string | null): void;
  onProblemAccepted(): void;
  onSubmissionError(error: SubmissionError): void;
  triggerHintShortcut(): void;
  triggerErrorShortcut(): void;
}

interface PanelAppProps {
  initialProviderId: string;
  initialModelId: string;
  onRequestHint: (opts: {
    userQuestion?: string;
    hintLevel?: HintLevel;
    provider?: string;
    modelId?: string;
    submissionError?: SubmissionError;
  }) => Promise<{ codeCaptureIncomplete: boolean; codeCaptureFailureReason?: string }>;
  onRequestInterviewTurn: (opts: {
    userQuestion?: string;
    interviewLevel: InterviewLevel;
    pressureLevel: PressureLevel;
    interviewPhase: InterviewPhase;
    provider?: string;
    modelId?: string;
    jd?: string;
    interviewer?: InterviewerProfile;
  }) => Promise<{ codeCaptureIncomplete: boolean; codeCaptureFailureReason?: string }>;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onRequestServerInfo: () => void;
  onRequestAwsProfiles: () => void;
  onCancelHint: () => void;
  onRequestJDAnalysis: (jdText: string, provider?: string, modelId?: string, awsProfile?: string, lcQuestionCount?: number, interviewQuestionCount?: number) => Promise<JDAnalysisResult>;
  onRequestInterviewerParse: (linkedInText: string, provider?: string, modelId?: string, awsProfile?: string) => Promise<InterviewerProfile>;
}

export const PanelApp = forwardRef<PanelHandle, PanelAppProps>(function PanelApp(
  {
    initialProviderId,
    initialModelId,
    onRequestHint,
    onRequestInterviewTurn,
    onProviderChange,
    onModelChange,
    onRequestServerInfo,
    onRequestAwsProfiles,
    onCancelHint,
    onRequestJDAnalysis,
    onRequestInterviewerParse,
  },
  ref
) {
  const [state, dispatch] = usePanelState();
  const { theme, toggleTheme } = useTheme();
  const {
    layout,
    updateLayout,
    toggleMinimized,
    toggleSidebarCollapsed,
    toggleHidden,
    startDrag,
    startResize,
    startWestEdgeResize,
    startEastEdgeResize,
    startNorthEdgeResize,
    startSouthEdgeResize,
    startSeamResize,
    startSidebarCorner,
  } = usePanelLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [awsProfiles, setAwsProfiles] = useState<string[]>([]);
  const [selectedAwsProfile, setSelectedAwsProfile] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Bumped on acceptance so the Solved/Attempted lists re-fetch — accepting
  // moves the current slug between them without necessarily changing it.
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const studyPlans = useStudyPlans(historyRefreshKey);
  const planContext = findPlanContext(studyPlans, state.problem?.slug);

  useImperativeHandle(ref, () => ({
    onProblemLoaded: (problem) => dispatch({ type: "problemLoaded", problem }),
    onGuidanceChunk: (chunk) => dispatch({ type: "guidanceChunk", chunk }),
    onConnectionError: (message) => dispatch({ type: "connectionError", message }),
    onGuidanceCancelled: () => dispatch({ type: "guidanceCancelled" }),
    onInterviewChunk: (chunk) => dispatch({ type: "interviewChunk", chunk }),
    onInterviewConnectionError: (message) => dispatch({ type: "interviewConnectionError", message }),
    onInterviewCancelled: () => dispatch({ type: "interviewCancelled" }),
    onServerInfoLoaded: (config, modelsByProvider) => dispatch({ type: "serverInfoLoaded", config, modelsByProvider }),
    onServerInfoFailed: (message) => dispatch({ type: "serverInfoFailed", message }),
    onAwsProfilesLoaded: (profiles, currentProfile) => {
      setAwsProfiles(profiles);
      if (!selectedAwsProfile && currentProfile) setSelectedAwsProfile(currentProfile);
    },
    onProblemAccepted: () => {
      dispatch({ type: "problemAccepted" });
      setHistoryRefreshKey((k) => k + 1);
    },
    onSubmissionError: (error) => dispatch({ type: "submissionErrorReceived", error }),
    triggerHintShortcut: () => {
      if (!state.isStreaming && state.problem) handleRequest();
    },
    triggerErrorShortcut: () => {
      if (!state.isStreaming && state.submissionError) handleExplainError();
    },
  }));

  useEffect(() => {
    dispatch({ type: "providerSelected", providerId: initialProviderId });
    dispatch({ type: "modelSelected", modelId: initialModelId });
    onRequestServerInfo();
    onRequestAwsProfiles();
    chrome.storage.local.get(STORAGE_KEY_AWS_PROFILE).then((stored) => {
      if (stored[STORAGE_KEY_AWS_PROFILE]) setSelectedAwsProfile(stored[STORAGE_KEY_AWS_PROFILE]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.serverInfoError && !state.serverConfig) {
      const timer = setTimeout(() => {
        onRequestServerInfo();
        onRequestAwsProfiles();
      }, 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.serverInfoError]);

  // Tracks which problem slugs a restore attempt has completed for, so the
  // persist effect below never overwrites the cache with the empty thread
  // that's briefly in state between a problem-change reset and the restore
  // actually landing.
  const restoredSlugsRef = useRef<Set<string>>(new Set());
  const slug = state.problem?.slug;

  useEffect(() => {
    if (!slug || restoredSlugsRef.current.has(slug)) return;
    loadThread(slug).then((entries) => {
      restoredSlugsRef.current.add(slug);
      if (entries && entries.length > 0) dispatch({ type: "threadRestored", slug, entries });
    });
  }, [slug]);

  useEffect(() => {
    if (!slug || state.isStreaming || !restoredSlugsRef.current.has(slug)) return;
    saveThread(slug, state.thread, Date.now());
  }, [slug, state.thread, state.isStreaming]);

  // Restore JD interview session on mount (survives tab switches / service worker restarts).
  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_JD_INTERVIEW_SESSION).then((stored) => {
      const session = stored[STORAGE_KEY_JD_INTERVIEW_SESSION];
      if (session?.interviewerProfile && session?.interviewThread?.length > 0) {
        dispatch({ type: "jdInterviewSessionRestored", session });
      }
    });
  }, []);

  // Persist JD interview session whenever it changes.
  useEffect(() => {
    if (state.interviewerProfile && state.interviewThread.length > 0) {
      chrome.storage.local.set({
        [STORAGE_KEY_JD_INTERVIEW_SESSION]: {
          interviewThread: state.interviewThread,
          interviewPhase: state.interviewPhase,
          interviewerProfile: state.interviewerProfile,
          jdText: state.jdText,
          linkedInText: state.linkedInText,
        },
      });
    }
  }, [state.interviewThread, state.interviewPhase, state.interviewerProfile, state.jdText]);

  // Clear persisted session when interviewer is cleared.
  useEffect(() => {
    if (!state.interviewerProfile) {
      chrome.storage.local.remove([STORAGE_KEY_JD_INTERVIEW_SESSION, STORAGE_KEY_JD_INTERVIEW_HISTORY]);
    }
  }, [state.interviewerProfile]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [state.thread, state.interviewThread]);

  const handleProviderChange = (providerId: string) => {
    dispatch({ type: "providerSelected", providerId });
    onProviderChange(providerId);
    onModelChange("");
  };

  const handleModelChange = (modelId: string) => {
    dispatch({ type: "modelSelected", modelId });
    onModelChange(modelId);
  };

  const handleAwsProfileChange = (profile: string) => {
    setSelectedAwsProfile(profile);
    chrome.storage.local.set({ [STORAGE_KEY_AWS_PROFILE]: profile });
  };

  const handleHide = () => {
    if (layout.hidden) {
      toggleHidden();
      return;
    }
    setHiding(true);
    setTimeout(() => {
      setHiding(false);
      toggleHidden();
    }, 250);
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

  const submitRequestWithError = async (userQuestion: string, hintLevel: HintLevel, submissionError: SubmissionError) => {
    const { codeCaptureIncomplete, codeCaptureFailureReason } = await onRequestHint({
      userQuestion,
      hintLevel,
      provider: state.selectedProviderId || undefined,
      modelId: state.selectedModelId || undefined,
      submissionError,
    });
    dispatch({
      type: "hintRequested",
      codeCaptureIncomplete,
      codeCaptureFailureReason,
      questionOverride: userQuestion,
      hintLevelOverride: hintLevel,
    });
  };

  const handleExplainError = () => {
    const error = state.submissionError;
    if (!error) return;
    dispatch({ type: "dismissSubmissionError" });
    submitRequestWithError(
      `My submission got "${error.message}". Help me understand why my approach fails without giving me the fix.`,
      1,
      error
    );
  };

  const submitInterviewTurn = async (userQuestion: string | undefined, phase: InterviewPhase) => {
    const jdActive = !!state.jdText.trim() && !!state.interviewerProfile;
    const { codeCaptureIncomplete, codeCaptureFailureReason } = await onRequestInterviewTurn({
      userQuestion,
      interviewLevel: state.interviewLevel,
      pressureLevel: state.pressureLevel,
      interviewPhase: phase,
      provider: state.selectedProviderId || undefined,
      modelId: state.selectedModelId || undefined,
      jd: jdActive ? state.jdText.trim() : undefined,
      interviewer: jdActive ? state.interviewerProfile! : undefined,
    });
    dispatch({
      type: "interviewTurnRequested",
      question: userQuestion,
      phase,
      codeCaptureIncomplete,
      codeCaptureFailureReason,
    });
  };

  const handleParseInterviewer = async () => {
    const text = state.linkedInText.trim();
    if (!text) return;
    dispatch({ type: "interviewerParseStarted" });
    try {
      const profile = await onRequestInterviewerParse(
        text,
        state.selectedProviderId || undefined,
        state.selectedModelId || undefined
      );
      dispatch({ type: "interviewerParsed", profile });
    } catch (err: any) {
      dispatch({ type: "interviewerParseErrored", message: err?.message ?? "Parse failed" });
    }
  };

  const handleStartInterview = () => submitInterviewTurn(undefined, "opening");

  const handleSendInterviewMessage = () => {
    const question = state.questionText.trim();
    if (!question) return;
    dispatch({ type: "questionTextChanged", text: "" });
    submitInterviewTurn(question, state.interviewPhase === "opening" ? "opening" : "grilling");
  };

  const handleDoneCoding = () => {
    submitInterviewTurn("I think I'm done — here's my code, ready for your questions.", "grilling");
  };

  const handleEndInterview = () => {
    submitInterviewTurn("I'd like to end the interview here — please give me my final evaluation.", "grading");
  };

  const effectiveProviderId = state.selectedProviderId || state.serverConfig?.defaultProvider || "";
  const FALLBACK_PROVIDERS: { id: LLMProviderId; label: string }[] = [
    { id: "bedrock", label: "AWS Bedrock" },
    { id: "openrouter", label: "OpenRouter" },
    { id: "local", label: "Local (Ollama)" },
  ];
  const providers = state.serverConfig?.providers ?? [];
  const selectedProviderInfo = providers.find((p) => p.id === effectiveProviderId);
  const availableModels = (effectiveProviderId && state.modelsByProvider[effectiveProviderId as LLMProviderId]) || [];
  const patternTags = (state.problem?.tags ?? []).filter((tag) => PATTERN_TAGS.has(tag));

  if (layout.hidden) {
    return (
      <button
        type="button"
        className={`lctrainer-notch theme-${theme} notch-enter`}
        style={{ position: "fixed", top: layout.top, right: 0, pointerEvents: "auto" }}
        onClick={handleHide}
        title="Show Leetcode Trainer"
      >
        <span className="notch-icon">‹</span>
      </button>
    );
  }

  return (
    <>
    <div
      className={`lctrainer-panel theme-${theme}${layout.minimized ? " minimized" : ""}${!layout.minimized && !layout.sidebarCollapsed ? " sidebar-attached" : ""}${hiding ? " panel-hiding" : ""}`}
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
        <div className="panel-header-left">
          <span className="panel-title">LC Trainer</span>
          <div className="mode-tabs" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`mode-tab${!state.interviewMode ? " active" : ""}`}
              onClick={() => { if (state.interviewMode) dispatch({ type: "interviewModeToggled" }); }}
            >
              Learn
            </button>
            <button
              type="button"
              className={`mode-tab${state.interviewMode ? " active" : ""}`}
              onClick={() => { if (!state.interviewMode) dispatch({ type: "interviewModeToggled" }); }}
            >
              Mock
            </button>
          </div>
        </div>
        <div className="panel-header-actions">
          <button
            type="button"
            className={`header-btn${settingsOpen ? " active" : ""}`}
            title="Settings"
            onClick={() => setSettingsOpen(!settingsOpen)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            type="button"
            className="header-btn"
            title={layout.minimized ? "Expand panel" : "Collapse panel"}
            onClick={toggleMinimized}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {layout.minimized
                ? <polyline points="6 15 12 9 18 15" />
                : <polyline points="6 9 12 15 18 9" />
              }
            </svg>
          </button>
          <button
            type="button"
            className="header-btn sidebar-btn"
            title={layout.sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            onClick={toggleSidebarCollapsed}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {!layout.minimized && (
        <>
          {settingsOpen && (
            <div className="settings-panel">
              <div className="settings-panel-header">
                <span className="settings-panel-title">Settings</span>
                <button type="button" className="header-btn" onClick={() => setSettingsOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="settings-panel-body">
                <div className="settings-section">
                  <span className="settings-label">Theme</span>
                  <div className="settings-toggle-row">
                    <button
                      type="button"
                      className={`settings-toggle-btn${theme === "light" ? " active" : ""}`}
                      onClick={() => { if (theme !== "light") toggleTheme(); }}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      className={`settings-toggle-btn${theme === "dark" ? " active" : ""}`}
                      onClick={() => { if (theme !== "dark") toggleTheme(); }}
                    >
                      Dark
                    </button>
                  </div>
                </div>
                <div className="settings-section">
                  <span className="settings-label">Opacity</span>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={layout.opacity}
                    onChange={(e) => updateLayout({ opacity: Number(e.target.value) })}
                  />
                </div>

                <div className="settings-section">
                  <span className="settings-label">Provider</span>
                  <select
                    className="settings-select"
                    value={state.selectedProviderId}
                    onChange={(e) => handleProviderChange(e.target.value)}
                  >
                    <option value="">
                      {state.serverConfig ? `Server default (${state.serverConfig.defaultProvider})` : "Auto"}
                    </option>
                    {(providers.length > 0 ? providers : FALLBACK_PROVIDERS).map((p) => (
                      <option key={p.id} value={p.id}>{"label" in p ? p.label : p.id}</option>
                    ))}
                  </select>
                </div>

                <div className="settings-section">
                  <span className="settings-label">Model</span>
                  <select
                    className="settings-select"
                    value={state.selectedModelId}
                    onChange={(e) => handleModelChange(e.target.value)}
                  >
                    <option value="">
                      {availableModels.length === 0
                        ? state.serverConfig ? "Default (server configured)" : "Loading..."
                        : `Default (${selectedProviderInfo?.defaultModelId})`}
                    </option>
                    {availableModels.map((m) => (
                      <option key={m.modelId} value={m.modelId}>{m.modelName}</option>
                    ))}
                  </select>
                </div>

                {effectiveProviderId === "bedrock" && (
                  <div className="settings-section">
                    <span className="settings-label">AWS Profile</span>
                    <select
                      className="settings-select"
                      value={selectedAwsProfile}
                      onChange={(e) => handleAwsProfileChange(e.target.value)}
                    >
                      <option value="">Default</option>
                      {awsProfiles.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="panel-body" style={{ display: settingsOpen ? "none" : undefined }}>
          <div className="panel-meta">
            {planContext && (
              <div className="plan-context-bar">
                <button
                  type="button"
                  className="icon-button"
                  disabled={!planContext.prevSlug}
                  onClick={() => planContext.prevSlug && (window.location.href = canonicalProblemUrl(planContext.prevSlug))}
                >
                  ‹ Prev
                </button>
                <span className="plan-context-label">
                  {planContext.plan.name} {planContext.index + 1}/{planContext.total}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  disabled={!planContext.nextSlug}
                  onClick={() => planContext.nextSlug && (window.location.href = canonicalProblemUrl(planContext.nextSlug))}
                >
                  Next ›
                </button>
              </div>
            )}

            <div className="problem-title">
              {state.problem
                ? state.problem.title
                : state.interviewerProfile
                ? `Interview with ${state.interviewerProfile.name}`
                : "Loading problem..."}
            </div>

            {patternTags.length > 0 && (
              <div className="pattern-tags">
                {patternTags.map((tag) => (
                  <span className="pattern-tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}


            {state.interviewMode && (
              <>
                <label className="model-select-label">
                  Candidate level
                  <select
                    value={state.interviewLevel}
                    onChange={(e) => dispatch({ type: "interviewLevelChanged", interviewLevel: e.target.value as InterviewLevel })}
                    disabled={state.isInterviewStreaming || state.interviewThread.length > 0}
                  >
                    {(Object.keys(INTERVIEW_LEVEL_LABELS) as InterviewLevel[]).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {INTERVIEW_LEVEL_LABELS[lvl]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="model-select-label">
                  Pressure
                  <select
                    value={state.pressureLevel}
                    onChange={(e) => dispatch({ type: "pressureLevelChanged", pressureLevel: e.target.value as PressureLevel })}
                    disabled={state.isInterviewStreaming}
                  >
                    {(Object.keys(PRESSURE_LEVEL_LABELS) as PressureLevel[]).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {PRESSURE_LEVEL_LABELS[lvl]}
                      </option>
                    ))}
                  </select>
                </label>

                {state.interviewThread.length === 0 && (
                  <div className="jd-setup-section">
                    <button
                      type="button"
                      className="jd-setup-toggle"
                      onClick={() => dispatch({ type: "jdInterviewSetupToggled" })}
                    >
                      <span>{state.jdInterviewSetupOpen ? "▾" : "▸"}</span>
                      {state.interviewerProfile
                        ? `Interviewer: ${state.interviewerProfile.name}`
                        : "JD Interview Setup"}
                      {(state.jdText.trim() || state.interviewerProfile) && (
                        <span className="jd-setup-badge">●</span>
                      )}
                    </button>

                    {state.jdInterviewSetupOpen && (
                      <div className="jd-setup-body">
                        <label className="jd-setup-label">
                          Job Description
                          <textarea
                            className="jd-setup-textarea"
                            placeholder="Paste the job description here..."
                            value={state.jdText}
                            onChange={(e) => dispatch({ type: "jdTextChanged", text: e.target.value })}
                            rows={4}
                          />
                        </label>

                        {!state.interviewerProfile ? (
                          <>
                            <label className="jd-setup-label">
                              Interviewer LinkedIn Profile
                              <textarea
                                className="jd-setup-textarea"
                                placeholder="Paste LinkedIn experience / About section here..."
                                value={state.linkedInText}
                                onChange={(e) => dispatch({ type: "linkedInTextChanged", text: e.target.value })}
                                rows={4}
                              />
                            </label>
                            {state.interviewerParseError && (
                              <div className="jd-setup-error">{state.interviewerParseError}</div>
                            )}
                            <button
                              type="button"
                              className="jd-setup-parse-btn"
                              onClick={handleParseInterviewer}
                              disabled={state.isParsingInterviewer || !state.linkedInText.trim()}
                            >
                              {state.isParsingInterviewer ? "Parsing..." : "Parse interviewer"}
                            </button>
                          </>
                        ) : (
                          <div className="interviewer-card">
                            <div className="interviewer-card-header">
                              <span className="interviewer-card-title">Interviewer</span>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => dispatch({ type: "interviewerProfileCleared" })}
                                title="Clear interviewer"
                              >
                                ✕
                              </button>
                            </div>
                            <label className="jd-setup-label">
                              Name
                              <input
                                type="text"
                                className="jd-setup-input"
                                value={state.interviewerProfile.name}
                                onChange={(e) => dispatch({ type: "interviewerProfileEdited", patch: { name: e.target.value } })}
                              />
                            </label>
                            <label className="jd-setup-label">
                              Title
                              <input
                                type="text"
                                className="jd-setup-input"
                                value={state.interviewerProfile.title}
                                onChange={(e) => dispatch({ type: "interviewerProfileEdited", patch: { title: e.target.value } })}
                              />
                            </label>
                            <label className="jd-setup-label">
                              Company
                              <input
                                type="text"
                                className="jd-setup-input"
                                value={state.interviewerProfile.company}
                                onChange={(e) => dispatch({ type: "interviewerProfileEdited", patch: { company: e.target.value } })}
                              />
                            </label>
                            <label className="jd-setup-label">
                              Technical areas
                              <input
                                type="text"
                                className="jd-setup-input"
                                value={state.interviewerProfile.technicalAreas.join(", ")}
                                onChange={(e) => {
                                  const areas = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                  dispatch({ type: "interviewerProfileEdited", patch: { technicalAreas: areas } });
                                }}
                              />
                            </label>
                            <label className="jd-setup-label">
                              Inferred style
                              <textarea
                                className="jd-setup-textarea"
                                value={state.interviewerProfile.inferredStyle}
                                onChange={(e) => dispatch({ type: "interviewerProfileEdited", patch: { inferredStyle: e.target.value } })}
                                rows={3}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel-output" ref={outputRef}>
            {state.interviewMode ? (
              <>
                {state.codeCaptureIncomplete && (
                  <div className="incomplete-notice">
                    Code capture may be incomplete
                    {state.codeCaptureFailureReason ? `: ${state.codeCaptureFailureReason}.` : "."}
                  </div>
                )}
                <InterviewPanel thread={state.interviewThread} />
              </>
            ) : (
              <>
                {state.submissionError && (
                  <div className="error-offer">
                    <span>{state.submissionError.message} — want to understand why?</span>
                    <div className="error-offer-actions">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={handleExplainError}
                        disabled={state.isStreaming}
                      >
                        Explain error
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => dispatch({ type: "dismissSubmissionError" })}
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
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
                <ThreadPanel
                  thread={state.thread}
                  onReuseQuestion={(question, hintLevel) => {
                    dispatch({ type: "questionTextChanged", text: question });
                    dispatch({ type: "hintLevelChanged", hintLevel });
                  }}
                  onDeleteEntry={(index) => dispatch({ type: "threadEntryDeleted", index })}
                />
              </>
            )}
          </div>

          <div className="panel-composer" style={{ display: settingsOpen ? "none" : undefined }}>
            {state.interviewMode ? (
              state.interviewThread.length === 0 ? (
                <div className="panel-controls-row">
                  <button
                    className="primary-btn"
                    onClick={handleStartInterview}
                    disabled={state.isInterviewStreaming || (!state.problem && !(state.jdText.trim() && state.interviewerProfile))}
                  >
                    {state.isInterviewStreaming ? "Starting..." : "Start interview"}
                  </button>
                </div>
              ) : (
                <div className="composer-bar">
                  <textarea
                    className="composer-input"
                    placeholder="Talk through your approach, answer a follow-up..."
                    value={state.questionText}
                    onChange={(e) => dispatch({ type: "questionTextChanged", text: e.target.value })}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!state.isInterviewStreaming && (state.problem || (state.jdText.trim() && state.interviewerProfile))) handleSendInterviewMessage();
                      }
                    }}
                  />
                  <div className="composer-toolbar">
                    <div className="composer-toolbar-left">
                      {state.interviewPhase === "opening" && (
                        <button
                          type="button"
                          className="composer-action-btn"
                          onClick={handleDoneCoding}
                          disabled={state.isInterviewStreaming || (!state.problem && !(state.jdText.trim() && state.interviewerProfile))}
                          title="Tell the interviewer you're done coding"
                        >
                          Done coding
                        </button>
                      )}
                      <button
                        type="button"
                        className="composer-action-btn composer-action-danger"
                        onClick={handleEndInterview}
                        disabled={state.isInterviewStreaming || (!state.problem && !(state.jdText.trim() && state.interviewerProfile))}
                        title="End and get final evaluation"
                      >
                        End &amp; grade
                      </button>
                    </div>
                    {state.isInterviewStreaming ? (
                      <button type="button" className="composer-send-btn composer-cancel-btn" onClick={onCancelHint}>
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="composer-send-btn"
                        onClick={handleSendInterviewMessage}
                        disabled={!state.problem && !(state.jdText.trim() && state.interviewerProfile)}
                        title="Send"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
              <>
                <HintLevelPicker
                  value={state.hintLevel}
                  onChange={(level) => dispatch({ type: "hintLevelChanged", hintLevel: level })}
                />
                <div className="composer-bar">
                  <textarea
                    className="composer-input"
                    placeholder="Ask a question, or just send for a hint..."
                    value={state.questionText}
                    onChange={(e) => dispatch({ type: "questionTextChanged", text: e.target.value })}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!state.isStreaming && state.problem) handleRequest();
                      }
                    }}
                  />
                  <div className="composer-toolbar">
                    <div className="composer-toolbar-left">
                      <button
                        type="button"
                        className="composer-action-btn"
                        onClick={handleComplexityCheck}
                        disabled={state.isStreaming || !state.problem}
                        title="Check time/space complexity"
                      >
                        Complexity
                      </button>
                    </div>
                    {state.isStreaming ? (
                      <button type="button" className="composer-send-btn composer-cancel-btn" onClick={onCancelHint}>
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="composer-send-btn"
                        onClick={handleRequest}
                        disabled={!state.problem}
                        title={state.questionText.trim() ? "Send" : "Get a hint"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
          </div>

          <div className="panel-footer">
            <span className="panel-footer-version">v{chrome.runtime.getManifest().version}</span>
            <span>Made by Vectr Labs</span>
          </div>

          <div className="resize-handle resize-handle-nw" onPointerDown={(e) => startResize(e, "nw")} />
          <div className="resize-handle resize-handle-sw" onPointerDown={(e) => startResize(e, "sw")} />
          <div className="edge-resize-handle edge-resize-handle-n" onPointerDown={startNorthEdgeResize} />
          <div className="edge-resize-handle edge-resize-handle-w" onPointerDown={startWestEdgeResize} />
          <div className="edge-resize-handle edge-resize-handle-s" onPointerDown={startSouthEdgeResize} />
          {!layout.sidebarCollapsed && (
            <div className="edge-resize-handle edge-resize-handle-seam" onPointerDown={startSeamResize} />
          )}
        </>
      )}
    </div>
    {!layout.minimized && (
      <Sidebar
        theme={theme}
        top={layout.top}
        left={layout.left + layout.width}
        width={layout.sidebarWidth}
        height={layout.height}
        collapsed={layout.sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onHideAll={handleHide}
        onEastEdgeResizeStart={startEastEdgeResize}
        onNorthEdgeResizeStart={startNorthEdgeResize}
        onSouthEdgeResizeStart={startSouthEdgeResize}
        onCornerResizeStart={startSidebarCorner}
        solvedTab={
          <SolvedPanel
            currentSlug={state.problem?.slug}
            refreshKey={historyRefreshKey}
            onReuseQuestion={(question, hintLevel) => {
              dispatch({ type: "questionTextChanged", text: question });
              dispatch({ type: "hintLevelChanged", hintLevel });
            }}
          />
        }
        attemptedTab={
          <AttemptedPanel
            currentSlug={state.problem?.slug}
            refreshKey={historyRefreshKey}
            onReuseQuestion={(question, hintLevel) => {
              dispatch({ type: "questionTextChanged", text: question });
              dispatch({ type: "hintLevelChanged", hintLevel });
            }}
          />
        }
        studyPlanTab={
          <StudyPlanPanel
            currentSlug={state.problem?.slug}
            refreshKey={historyRefreshKey}
            onPlansChanged={() => setHistoryRefreshKey((k) => k + 1)}
          />
        }
        jdTab={
          <JDAnalyzerPanel
            onRequestJDAnalysis={(jdText, lcQuestionCount, interviewQuestionCount) =>
              onRequestJDAnalysis(
                jdText,
                state.selectedProviderId || undefined,
                state.selectedModelId || undefined,
                selectedAwsProfile || undefined,
                lcQuestionCount,
                interviewQuestionCount,
              )
            }
            onPlanSaved={() => setHistoryRefreshKey((k) => k + 1)}
          />
        }
      />
    )}
    </>
  );
});
