import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePanelState } from "./usePanelState.js";

describe("usePanelState", () => {
  it("starts idle with empty text", () => {
    const { result } = renderHook(() => usePanelState());
    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(state.hintText).toBe("");
    expect(state.error).toBeNull();
  });

  it("accumulates token deltas while streaming", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "Hel" } }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "lo" } }));

    const [state] = result.current;
    expect(state.hintText).toBe("Hello");
    expect(state.isStreaming).toBe(true);
  });

  it("accumulates reasoning deltas separately from hint text", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "reasoning", delta: "thinking..." } }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "answer" } }));

    const [state] = result.current;
    expect(state.reasoningText).toBe("thinking...");
    expect(state.hintText).toBe("answer");
  });

  it("stops streaming on a done chunk", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "done" } }));

    expect(result.current[0].isStreaming).toBe(false);
  });

  it("stops streaming and records the message on an error chunk", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "error", message: "boom" } }));

    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBe("boom");
  });

  it("clears previous hint/reasoning/error when a new request starts", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "old" } }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "error", message: "oops" } }));

    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: true }));

    const [state] = result.current;
    expect(state.hintText).toBe("");
    expect(state.reasoningText).toBe("");
    expect(state.error).toBeNull();
    expect(state.isStreaming).toBe(true);
    expect(state.codeCaptureIncomplete).toBe(true);
  });

  it("stops streaming and records the message on a connectionError", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "connectionError", message: "lost connection" }));

    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBe("lost connection");
  });

  it("resets selectedModelId when a new provider is selected", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "modelSelected", modelId: "gpt-4" }));
    act(() => result.current[1]({ type: "providerSelected", providerId: "openrouter" }));

    const [state] = result.current;
    expect(state.selectedProviderId).toBe("openrouter");
    expect(state.selectedModelId).toBe("");
  });
});
