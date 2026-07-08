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

  it("records estimatedCostUsd from a done chunk onto the current entry", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() =>
      result.current[1]({
        type: "guidanceChunk",
        chunk: { type: "done", usage: { inputTokens: 100, outputTokens: 50 }, estimatedCostUsd: 0.001 },
      })
    );

    expect(lastEntry(result.current[0].thread).estimatedCostUsd).toBe(0.001);
  });

  it("leaves estimatedCostUsd null when a done chunk carries no cost (e.g. local/Ollama)", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    act(() => result.current[1]({ type: "guidanceChunk", chunk: { type: "done" } }));

    expect(lastEntry(result.current[0].thread).estimatedCostUsd).toBeNull();
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
        problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", tags: [], statementHtml: "", url: "" },
      })
    );
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    expect(result.current[0].thread).toHaveLength(1);

    act(() =>
      result.current[1]({
        type: "problemLoaded",
        problem: { slug: "three-sum", title: "3Sum", difficulty: "Medium", tags: [], statementHtml: "", url: "" },
      })
    );
    expect(result.current[0].thread).toEqual([]);
  });

  it("shows the accepted review offer on problemAccepted and clears it on dismiss", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "problemAccepted" }));
    expect(result.current[0].showAcceptedReviewOffer).toBe(true);

    act(() => result.current[1]({ type: "dismissAcceptedReviewOffer" }));
    expect(result.current[0].showAcceptedReviewOffer).toBe(false);
  });

  it("clears the accepted review offer when a new hint is requested", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "problemAccepted" }));
    act(() => result.current[1]({ type: "hintRequested", codeCaptureIncomplete: false }));
    expect(result.current[0].showAcceptedReviewOffer).toBe(false);
  });

  it("applies threadRestored when it matches the current problem", () => {
    const { result } = renderHook(() => usePanelState());
    act(() =>
      result.current[1]({
        type: "problemLoaded",
        problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", tags: [], statementHtml: "", url: "" },
      })
    );
    const cached = [
      { question: "old q", hintLevel: 1 as const, hintText: "old a", reasoningText: "", error: null, estimatedCostUsd: null, timestamp: 0 },
    ];
    act(() => result.current[1]({ type: "threadRestored", slug: "two-sum", entries: cached }));
    expect(result.current[0].thread).toEqual(cached);
  });

  it("ignores threadRestored for a stale slug the user has since navigated away from", () => {
    const { result } = renderHook(() => usePanelState());
    act(() =>
      result.current[1]({
        type: "problemLoaded",
        problem: { slug: "three-sum", title: "3Sum", difficulty: "Medium", tags: [], statementHtml: "", url: "" },
      })
    );
    const stale = [
      { question: "stale", hintLevel: 1 as const, hintText: "x", reasoningText: "", error: null, estimatedCostUsd: null, timestamp: 0 },
    ];
    act(() => result.current[1]({ type: "threadRestored", slug: "two-sum", entries: stale }));
    expect(result.current[0].thread).toEqual([]);
  });

  it("removes a thread entry by index on threadEntryDeleted", () => {
    const { result } = renderHook(() => usePanelState());
    act(() =>
      result.current[1]({
        type: "problemLoaded",
        problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", tags: [], statementHtml: "", url: "" },
      })
    );
    const entries = [
      { question: "q1", hintLevel: 1 as const, hintText: "a1", reasoningText: "", error: null, estimatedCostUsd: null, timestamp: 0 },
      { question: "q2", hintLevel: 1 as const, hintText: "a2", reasoningText: "", error: null, estimatedCostUsd: null, timestamp: 0 },
    ];
    act(() => result.current[1]({ type: "threadRestored", slug: "two-sum", entries }));
    act(() => result.current[1]({ type: "threadEntryDeleted", index: 0 }));

    expect(result.current[0].thread).toEqual([entries[1]]);
  });

  it("resets selectedModelId when a new provider is selected", () => {
    const { result } = renderHook(() => usePanelState());
    act(() => result.current[1]({ type: "modelSelected", modelId: "gpt-4" }));
    act(() => result.current[1]({ type: "providerSelected", providerId: "openrouter" }));

    const [state] = result.current;
    expect(state.selectedProviderId).toBe("openrouter");
    expect(state.selectedModelId).toBe("");
  });

  describe("interview mode", () => {
    it("starts off, defaulting to mid/standard", () => {
      const { result } = renderHook(() => usePanelState());
      const [state] = result.current;
      expect(state.interviewMode).toBe(false);
      expect(state.interviewLevel).toBe("mid");
      expect(state.pressureLevel).toBe("standard");
      expect(state.interviewThread).toEqual([]);
    });

    it("toggles independently of learn-mode state", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewModeToggled" }));
      expect(result.current[0].interviewMode).toBe(true);
      act(() => result.current[1]({ type: "interviewModeToggled" }));
      expect(result.current[0].interviewMode).toBe(false);
    });

    it("updates interviewLevel and pressureLevel independently", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewLevelChanged", interviewLevel: "principal" }));
      act(() => result.current[1]({ type: "pressureLevelChanged", pressureLevel: "stress" }));

      const [state] = result.current;
      expect(state.interviewLevel).toBe("principal");
      expect(state.pressureLevel).toBe("stress");
    });

    it("appends an interview entry on interviewTurnRequested and accumulates tokens into it", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "opening", codeCaptureIncomplete: false }));
      act(() => result.current[1]({ type: "interviewChunk", chunk: { type: "token", delta: "Let's start with " } }));
      act(() => result.current[1]({ type: "interviewChunk", chunk: { type: "token", delta: "the problem." } }));

      const [state] = result.current;
      expect(state.interviewThread).toHaveLength(1);
      expect(state.interviewThread[0].answerText).toBe("Let's start with the problem.");
      expect(state.interviewThread[0].phase).toBe("opening");
      expect(state.isInterviewStreaming).toBe(true);
    });

    it("tracks interviewPhase from the most recent turn", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "opening", codeCaptureIncomplete: false }));
      expect(result.current[0].interviewPhase).toBe("opening");

      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "grilling", codeCaptureIncomplete: false }));
      expect(result.current[0].interviewPhase).toBe("grilling");
    });

    it("stops interview streaming on an interview done chunk", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "opening", codeCaptureIncomplete: false }));
      act(() => result.current[1]({ type: "interviewChunk", chunk: { type: "done" } }));
      expect(result.current[0].isInterviewStreaming).toBe(false);
    });

    it("drops the in-flight interview entry on interviewCancelled", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "opening", codeCaptureIncomplete: false }));
      act(() => result.current[1]({ type: "interviewChunk", chunk: { type: "token", delta: "partial" } }));
      act(() => result.current[1]({ type: "interviewCancelled" }));

      const [state] = result.current;
      expect(state.isInterviewStreaming).toBe(false);
      expect(state.interviewThread).toEqual([]);
    });

    it("records the message on an interview connectionError", () => {
      const { result } = renderHook(() => usePanelState());
      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "opening", codeCaptureIncomplete: false }));
      act(() => result.current[1]({ type: "interviewConnectionError", message: "lost connection" }));

      const [state] = result.current;
      expect(state.isInterviewStreaming).toBe(false);
      expect(state.interviewThread[0].error).toBe("lost connection");
    });

    it("clears the interview thread and resets phase to opening when a different problem loads", () => {
      const { result } = renderHook(() => usePanelState());
      act(() =>
        result.current[1]({
          type: "problemLoaded",
          problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", tags: [], statementHtml: "", url: "" },
        })
      );
      act(() => result.current[1]({ type: "interviewTurnRequested", phase: "grilling", codeCaptureIncomplete: false }));
      expect(result.current[0].interviewThread).toHaveLength(1);

      act(() =>
        result.current[1]({
          type: "problemLoaded",
          problem: { slug: "three-sum", title: "3Sum", difficulty: "Medium", tags: [], statementHtml: "", url: "" },
        })
      );
      expect(result.current[0].interviewThread).toEqual([]);
      expect(result.current[0].interviewPhase).toBe("opening");
    });
  });
});
