import { useReducer } from "react";
import type { BedrockModelInfo, GuidanceChunk, ProblemMetadata, ServerConfigInfo } from "@lctrainer/shared";

export interface PanelState {
  problem: ProblemMetadata | null;
  hintText: string;
  isStreaming: boolean;
  error: string | null;
  codeCaptureIncomplete: boolean;
  questionText: string;
  serverConfig: ServerConfigInfo | null;
  bedrockModels: BedrockModelInfo[];
  selectedModelId: string;
  serverInfoError: string | null;
}

type PanelAction =
  | { type: "problemLoaded"; problem: ProblemMetadata | null }
  | { type: "hintRequested"; codeCaptureIncomplete: boolean }
  | { type: "guidanceChunk"; chunk: GuidanceChunk }
  | { type: "connectionError"; message: string }
  | { type: "questionTextChanged"; text: string }
  | { type: "serverInfoLoaded"; config: ServerConfigInfo; models: BedrockModelInfo[] }
  | { type: "serverInfoFailed"; message: string }
  | { type: "modelSelected"; modelId: string };

const initialState: PanelState = {
  problem: null,
  hintText: "",
  isStreaming: false,
  error: null,
  codeCaptureIncomplete: false,
  questionText: "",
  serverConfig: null,
  bedrockModels: [],
  selectedModelId: "",
  serverInfoError: null,
};

function reducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "problemLoaded":
      return { ...state, problem: action.problem };
    case "hintRequested":
      return {
        ...state,
        hintText: "",
        isStreaming: true,
        error: null,
        codeCaptureIncomplete: action.codeCaptureIncomplete,
      };
    case "guidanceChunk":
      if (action.chunk.type === "token") {
        return { ...state, hintText: state.hintText + action.chunk.delta };
      }
      if (action.chunk.type === "done") {
        return { ...state, isStreaming: false };
      }
      // error
      return { ...state, isStreaming: false, error: action.chunk.message };
    case "connectionError":
      return { ...state, isStreaming: false, error: action.message };
    case "questionTextChanged":
      return { ...state, questionText: action.text };
    case "serverInfoLoaded":
      return { ...state, serverConfig: action.config, bedrockModels: action.models, serverInfoError: null };
    case "serverInfoFailed":
      return { ...state, serverInfoError: action.message };
    case "modelSelected":
      return { ...state, selectedModelId: action.modelId };
    default:
      return state;
  }
}

export function usePanelState() {
  return useReducer(reducer, initialState);
}
