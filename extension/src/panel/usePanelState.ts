import { useReducer } from "react";
import type {
  GuidanceChunk,
  HintLevel,
  InterviewerProfile,
  InterviewLevel,
  InterviewPhase,
  LLMProviderId,
  ModelInfo,
  PressureLevel,
  ProblemMetadata,
  ServerConfigInfo,
  SubmissionError,
} from "@lctrainer/shared";

export interface ThreadEntry {
  question: string;
  hintLevel: HintLevel;
  hintText: string;
  reasoningText: string;
  error: string | null;
  estimatedCostUsd: number | null;
  timestamp: number;
}

export interface InterviewEntry {
  question: string;
  phase: InterviewPhase;
  answerText: string;
  reasoningText: string;
  error: string | null;
  estimatedCostUsd: number | null;
  timestamp: number;
}

export interface PanelState {
  problem: ProblemMetadata | null;
  /** Past + in-flight exchanges for the current problem, oldest first. The last entry is live while isStreaming is true. */
  thread: ThreadEntry[];
  isStreaming: boolean;
  codeCaptureIncomplete: boolean;
  codeCaptureFailureReason: string | null;
  questionText: string;
  hintLevel: HintLevel;
  serverConfig: ServerConfigInfo | null;
  modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>>;
  selectedProviderId: string;
  selectedModelId: string;
  serverInfoError: string | null;
  showAcceptedReviewOffer: boolean;
  submissionError: SubmissionError | null;
  /** Interview mode is a separate mode from learning — its own thread/phase/settings, toggled independently per problem. */
  interviewMode: boolean;
  interviewThread: InterviewEntry[];
  interviewPhase: InterviewPhase;
  interviewLevel: InterviewLevel;
  pressureLevel: PressureLevel;
  isInterviewStreaming: boolean;
  /** JD-based interview setup */
  jdInterviewSetupOpen: boolean;
  jdText: string;
  linkedInText: string;
  interviewerProfile: InterviewerProfile | null;
  isParsingInterviewer: boolean;
  interviewerParseError: string | null;
}

type PanelAction =
  | { type: "problemLoaded"; problem: ProblemMetadata | null }
  | {
      type: "hintRequested";
      codeCaptureIncomplete: boolean;
      codeCaptureFailureReason?: string;
      questionOverride?: string;
      hintLevelOverride?: HintLevel;
    }
  | { type: "guidanceChunk"; chunk: GuidanceChunk }
  | { type: "connectionError"; message: string }
  | { type: "guidanceCancelled" }
  | { type: "questionTextChanged"; text: string }
  | { type: "hintLevelChanged"; hintLevel: HintLevel }
  | { type: "serverInfoLoaded"; config: ServerConfigInfo; modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>> }
  | { type: "serverInfoFailed"; message: string }
  | { type: "providerSelected"; providerId: string }
  | { type: "modelSelected"; modelId: string }
  | { type: "problemAccepted" }
  | { type: "dismissAcceptedReviewOffer" }
  | { type: "threadRestored"; slug: string; entries: ThreadEntry[] }
  | { type: "threadEntryDeleted"; index: number }
  | { type: "submissionErrorReceived"; error: SubmissionError }
  | { type: "dismissSubmissionError" }
  | { type: "interviewModeToggled" }
  | { type: "interviewLevelChanged"; interviewLevel: InterviewLevel }
  | { type: "pressureLevelChanged"; pressureLevel: PressureLevel }
  | { type: "interviewTurnRequested"; question?: string; phase: InterviewPhase; codeCaptureIncomplete: boolean; codeCaptureFailureReason?: string }
  | { type: "interviewChunk"; chunk: GuidanceChunk }
  | { type: "interviewConnectionError"; message: string }
  | { type: "interviewCancelled" }
  | { type: "jdInterviewSetupToggled" }
  | { type: "jdTextChanged"; text: string }
  | { type: "linkedInTextChanged"; text: string }
  | { type: "interviewerParseStarted" }
  | { type: "interviewerParsed"; profile: InterviewerProfile }
  | { type: "interviewerParseErrored"; message: string }
  | { type: "interviewerProfileEdited"; patch: Partial<InterviewerProfile> }
  | { type: "interviewerProfileCleared" }
  | { type: "jdInterviewSessionRestored"; session: { interviewThread: PanelState["interviewThread"]; interviewPhase: PanelState["interviewPhase"]; interviewerProfile: NonNullable<PanelState["interviewerProfile"]>; jdText: string; linkedInText: string } }
;

const initialState: PanelState = {
  problem: null,
  thread: [],
  isStreaming: false,
  codeCaptureIncomplete: false,
  codeCaptureFailureReason: null,
  questionText: "",
  hintLevel: 1,
  serverConfig: null,
  modelsByProvider: {},
  selectedProviderId: "",
  selectedModelId: "",
  serverInfoError: null,
  showAcceptedReviewOffer: false,
  submissionError: null,
  interviewMode: false,
  interviewThread: [],
  interviewPhase: "opening",
  interviewLevel: "mid",
  pressureLevel: "standard",
  isInterviewStreaming: false,
  jdInterviewSetupOpen: false,
  jdText: "",
  linkedInText: "",
  interviewerProfile: null,
  isParsingInterviewer: false,
  interviewerParseError: null,
};

function updateLastEntry<T>(thread: T[], patch: Partial<T>): T[] {
  const last = thread[thread.length - 1];
  if (!last) return thread;
  return [...thread.slice(0, -1), { ...last, ...patch }];
}

function reducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "problemLoaded": {
      // A different problem loaded — the learn thread belongs to the old one.
      if (action.problem?.slug !== state.problem?.slug) {
        // JD interview is persona-driven and spans the whole session — don't
        // reset it when the user navigates to a different problem/tab.
        const jdInterviewActive = !!state.interviewerProfile && state.interviewThread.length > 0;
        return {
          ...state,
          problem: action.problem,
          thread: [],
          showAcceptedReviewOffer: false,
          submissionError: null,
          interviewMode: jdInterviewActive ? true : state.interviewMode,
          interviewThread: jdInterviewActive ? state.interviewThread : [],
          interviewPhase: jdInterviewActive ? state.interviewPhase : "opening",
        };
      }
      return { ...state, problem: action.problem };
    }
    case "hintRequested": {
      const entry: ThreadEntry = {
        question: action.questionOverride ?? state.questionText.trim(),
        hintLevel: action.hintLevelOverride ?? state.hintLevel,
        hintText: "",
        reasoningText: "",
        error: null,
        estimatedCostUsd: null,
        timestamp: Date.now(),
      };
      return {
        ...state,
        thread: [...state.thread, entry],
        isStreaming: true,
        questionText: "",
        codeCaptureIncomplete: action.codeCaptureIncomplete,
        codeCaptureFailureReason: action.codeCaptureFailureReason ?? null,
        showAcceptedReviewOffer: false,
      };
    }
    case "guidanceChunk":
      if (action.chunk.type === "token") {
        return { ...state, thread: updateLastEntry(state.thread, { hintText: (state.thread.at(-1)?.hintText ?? "") + action.chunk.delta }) };
      }
      if (action.chunk.type === "reasoning") {
        return {
          ...state,
          thread: updateLastEntry(state.thread, { reasoningText: (state.thread.at(-1)?.reasoningText ?? "") + action.chunk.delta }),
        };
      }
      if (action.chunk.type === "done") {
        return {
          ...state,
          isStreaming: false,
          thread: updateLastEntry(state.thread, { estimatedCostUsd: action.chunk.estimatedCostUsd ?? null }),
        };
      }
      // error
      return { ...state, isStreaming: false, thread: updateLastEntry(state.thread, { error: action.chunk.message }) };
    case "connectionError":
      return { ...state, isStreaming: false, thread: updateLastEntry(state.thread, { error: action.message }) };
    case "guidanceCancelled":
      // Cancelled mid-stream — drop the incomplete entry rather than leaving a half-answer in the thread.
      return { ...state, isStreaming: false, thread: state.thread.slice(0, -1) };
    case "questionTextChanged":
      return { ...state, questionText: action.text };
    case "hintLevelChanged":
      return { ...state, hintLevel: action.hintLevel };
    case "serverInfoLoaded":
      return { ...state, serverConfig: action.config, modelsByProvider: action.modelsByProvider, serverInfoError: null };
    case "serverInfoFailed":
      return { ...state, serverInfoError: action.message };
    case "providerSelected":
      return { ...state, selectedProviderId: action.providerId, selectedModelId: "" };
    case "modelSelected":
      return { ...state, selectedModelId: action.modelId };
    case "problemAccepted":
      return { ...state, showAcceptedReviewOffer: true };
    case "dismissAcceptedReviewOffer":
      return { ...state, showAcceptedReviewOffer: false };
    case "submissionErrorReceived":
      return { ...state, submissionError: action.error };
    case "dismissSubmissionError":
      return { ...state, submissionError: null };
    case "threadRestored":
      // Cache lookup is async — only apply if the user is still on the problem it was fetched for.
      if (action.slug !== state.problem?.slug) return state;
      return { ...state, thread: action.entries };
    case "threadEntryDeleted":
      return { ...state, thread: state.thread.filter((_, i) => i !== action.index) };
    case "interviewModeToggled":
      return { ...state, interviewMode: !state.interviewMode };
    case "interviewLevelChanged":
      return { ...state, interviewLevel: action.interviewLevel };
    case "pressureLevelChanged":
      return { ...state, pressureLevel: action.pressureLevel };
    case "interviewTurnRequested": {
      const entry: InterviewEntry = {
        question: action.question ?? "",
        phase: action.phase,
        answerText: "",
        reasoningText: "",
        error: null,
        estimatedCostUsd: null,
        timestamp: Date.now(),
      };
      return {
        ...state,
        interviewThread: [...state.interviewThread, entry],
        interviewPhase: action.phase,
        isInterviewStreaming: true,
        codeCaptureIncomplete: action.codeCaptureIncomplete,
        codeCaptureFailureReason: action.codeCaptureFailureReason ?? null,
      };
    }
    case "interviewChunk":
      if (action.chunk.type === "token") {
        return {
          ...state,
          interviewThread: updateLastEntry(state.interviewThread, {
            answerText: (state.interviewThread.at(-1)?.answerText ?? "") + action.chunk.delta,
          }),
        };
      }
      if (action.chunk.type === "reasoning") {
        return {
          ...state,
          interviewThread: updateLastEntry(state.interviewThread, {
            reasoningText: (state.interviewThread.at(-1)?.reasoningText ?? "") + action.chunk.delta,
          }),
        };
      }
      if (action.chunk.type === "done") {
        return {
          ...state,
          isInterviewStreaming: false,
          interviewThread: updateLastEntry(state.interviewThread, { estimatedCostUsd: action.chunk.estimatedCostUsd ?? null }),
        };
      }
      // error
      return {
        ...state,
        isInterviewStreaming: false,
        interviewThread: updateLastEntry(state.interviewThread, { error: action.chunk.message }),
      };
    case "interviewConnectionError":
      return {
        ...state,
        isInterviewStreaming: false,
        interviewThread: updateLastEntry(state.interviewThread, { error: action.message }),
      };
    case "interviewCancelled":
      return { ...state, isInterviewStreaming: false, interviewThread: state.interviewThread.slice(0, -1) };
    case "jdInterviewSetupToggled":
      return { ...state, jdInterviewSetupOpen: !state.jdInterviewSetupOpen };
    case "jdTextChanged":
      return { ...state, jdText: action.text };
    case "linkedInTextChanged":
      return { ...state, linkedInText: action.text };
    case "interviewerParseStarted":
      return { ...state, isParsingInterviewer: true, interviewerParseError: null };
    case "interviewerParsed":
      return { ...state, isParsingInterviewer: false, interviewerProfile: action.profile, interviewerParseError: null };
    case "interviewerParseErrored":
      return { ...state, isParsingInterviewer: false, interviewerParseError: action.message };
    case "interviewerProfileEdited":
      if (!state.interviewerProfile) return state;
      return { ...state, interviewerProfile: { ...state.interviewerProfile, ...action.patch } };
    case "interviewerProfileCleared":
      return { ...state, interviewerProfile: null, linkedInText: "", interviewThread: [], interviewPhase: "opening", interviewMode: false };
    case "jdInterviewSessionRestored":
      return {
        ...state,
        interviewMode: true,
        interviewThread: action.session.interviewThread,
        interviewPhase: action.session.interviewPhase,
        interviewerProfile: action.session.interviewerProfile,
        jdText: action.session.jdText,
        linkedInText: action.session.linkedInText,
      };
    default:
      return state;
  }
}

export function usePanelState() {
  return useReducer(reducer, initialState);
}
