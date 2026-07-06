import { useReducer } from "react";
import type { GuidanceChunk, HintLevel, LLMProviderId, ModelInfo, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";

export interface ThreadEntry {
  question: string;
  hintLevel: HintLevel;
  hintText: string;
  reasoningText: string;
  error: string | null;
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
  | { type: "threadRestored"; slug: string; entries: ThreadEntry[] };

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
};

function updateLastEntry(thread: ThreadEntry[], patch: Partial<ThreadEntry>): ThreadEntry[] {
  const last = thread[thread.length - 1];
  if (!last) return thread;
  return [...thread.slice(0, -1), { ...last, ...patch }];
}

function reducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "problemLoaded":
      // A different problem loaded — the thread belongs to the old one.
      if (action.problem?.slug !== state.problem?.slug) {
        return { ...state, problem: action.problem, thread: [], showAcceptedReviewOffer: false };
      }
      return { ...state, problem: action.problem };
    case "hintRequested": {
      const entry: ThreadEntry = {
        question: action.questionOverride ?? state.questionText.trim(),
        hintLevel: action.hintLevelOverride ?? state.hintLevel,
        hintText: "",
        reasoningText: "",
        error: null,
      };
      return {
        ...state,
        thread: [...state.thread, entry],
        isStreaming: true,
        codeCaptureIncomplete: action.codeCaptureIncomplete,
        codeCaptureFailureReason: action.codeCaptureFailureReason ?? null,
        showAcceptedReviewOffer: false,
      };
    }
    case "guidanceChunk":
      if (action.chunk.type === "token") {
        return { ...state, ...appendToLast(state, "hintText", action.chunk.delta) };
      }
      if (action.chunk.type === "reasoning") {
        return { ...state, ...appendToLast(state, "reasoningText", action.chunk.delta) };
      }
      if (action.chunk.type === "done") {
        return { ...state, isStreaming: false };
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
    case "threadRestored":
      // Cache lookup is async — only apply if the user is still on the problem it was fetched for.
      if (action.slug !== state.problem?.slug) return state;
      return { ...state, thread: action.entries };
    default:
      return state;
  }
}

function appendToLast(state: PanelState, field: "hintText" | "reasoningText", delta: string): Pick<PanelState, "thread"> {
  const last = state.thread[state.thread.length - 1];
  if (!last) return { thread: state.thread };
  return { thread: [...state.thread.slice(0, -1), { ...last, [field]: last[field] + delta }] };
}

export function usePanelState() {
  return useReducer(reducer, initialState);
}
