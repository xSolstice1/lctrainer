import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePanelState } from "./usePanelState.js";

function lastEntry(thread: ReturnType<typeof usePanelState>[0]["thread"]) {
  return thread[thread.length - 1];
}

describe("usePanelState", () => {
  it("starts idle with an empty thread", () => {
    const { result } = renderHook(() => usePanelState());
    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(state.thread).toEqual([]);
    expect(state.hintLevel).toBe(1);
  });

  it("updates hintLevel on hintLevelChanged", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintLevelChanged", hintLevel: 3 }));
    expect(result.current[0].hintLevel).toBe(3);
  });

  it("records questionOverride/hintLevelOverride instead of the slider/textarea state", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintLevelChanged", hintLevel: 3 }));
    act(() => result.current[1]({ type: "questionTextChanged", text: "ignored" }));
    act(() =>
      result.current[1]({
        type: "hintRequested",
        codeCaptureIncomplete: false,
        questionOverride: "What's the complexity?",
        hintLevelOverride: 1,
      })
    );

    const entry = lastEntry(result.current[0].thread);
    expect(entry.question).toBe("What's the complexity?");
    expect(entry.hintLevel).toBe(1);
  });

  it("appends a new thread entry on hintRequested and accumulates token deltas into it", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "Hel" } }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "lo" } }));

    const [state] = result.current;
    expect(state.thread).toHaveLength(1);
    expect(lastEntry(state.thread).hintText).toBe("Hello");
    expect(state.isStreaming).toBe(true);
  });

  it("accumulates reasoning deltas separately from hint text on the current entry", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "reasoning", delta: "thinking..." } }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "answer" } }));

    const entry = lastEntry(result.current[0].thread);
    expect(entry.reasoningText).toBe("thinking...");
    expect(entry.hintText).toBe("answer");
  });

  it("stops streaming on a done chunk", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "done" } }));

    expect(result.current[0].isStreaming).toBe(false);
  });

  it("drops the in-flight entry on guidanceCancelled", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "partial" } }));
    act(() => result.current[1]({ type: "guidanceCancelled" }));

    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(state.thread).toEqual([]);
  });

  it("stops streaming and records the message on an error chunk", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "error", message: "boom" } }));

    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(lastEntry(state.thread).error).toBe("boom");
  });

  it("starts a fresh entry for each new request, keeping prior entries in the thread", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "token", delta: "old" } }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "done" } }));

    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: true }));

    const [state] = result.current;
    expect(state.thread).toHaveLength(2);
    expect(state.thread[0].hintText).toBe("old");
    expect(lastEntry(state.thread).hintText).toBe("");
    expect(state.isStreaming).toBe(true);
    expect(state.codeCaptureIncomplete).toBe(true);
  });

  it("records and clears codeCaptureFailureReason across requests", () => {
    const { result } = renderHook(() => usePanelState());
    act(() =>
      result.current[1]({
        type: "hintRequested",
        codeCaptureIncomplete: true,
        codeCaptureFailureReason: "The code editor didn't respond in time",
      })
    );
    expect(result.current[0].codeCaptureFailureReason).toBe("The code editor didn't respond in time");

    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    expect(result.current[0].codeCaptureFailureReason).toBeNull();
  });

  it("stops streaming and records the message on a connectionError", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "connectionError", message: "lost connection" }));

    const [state] = result.current;
    expect(state.isStreaming).toBe(false);
    expect(lastEntry(state.thread).error).toBe("lost connection");
  });

  it("clears the thread when a different problem loads", () => {
    const { result } = renderHook(() => usePanelState());
    act(() =>
      result.current[1]({
        type: "problemLoaded",
        problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", tags: [], statementHtml: "" },
      })
    );
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    expect(result.current[0].thread).toHaveLength(1);

    act(() =>
      result.current[1]({
        type: "problemLoaded",
        problem: { slug: "three-sum", title: "3Sum", difficulty: "Medium", tags: [], statementHtml: "" },
      })
    );
    expect(result.current[0].thread).toEqual([]);
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
