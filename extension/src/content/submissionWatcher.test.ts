import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onError } from "./submissionWatcher.js";
import type { SubmissionError } from "@lctrainer/shared";

function setResultPanel(html: string) {
  document.body.innerHTML = html;
}

function triggerMutation() {
  // Force MutationObserver callbacks to flush in jsdom
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onError", () => {
  it("does not fire when result is Accepted", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`<div data-e2e-locator="console-result">Accepted</div>`);
    await triggerMutation();

    expect(cb).not.toHaveBeenCalled();
    dispose();
  });

  it("fires with wrong_answer kind when result is Wrong Answer", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`
      <div data-e2e-locator="console-result">Wrong Answer</div>
      <div class="text-xs font-medium text-label-3">Input</div>
      <div class="font-menlo mx-3">[2,7,11,15]</div>
      <div class="text-xs font-medium text-label-3">Output</div>
      <div class="font-menlo mx-3">[]</div>
      <div class="text-xs font-medium text-label-3">Expected</div>
      <div class="font-menlo mx-3">[0,1]</div>
    `);
    await triggerMutation();

    expect(cb).toHaveBeenCalledOnce();
    const result: SubmissionError = cb.mock.calls[0][0];
    expect(result.kind).toBe("wrong_answer");
    expect(result.message).toBe("Wrong Answer");
  });

  it("fires with runtime_error kind when result is Runtime Error", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`<div data-e2e-locator="console-result">Runtime Error</div>`);
    await triggerMutation();

    expect(cb).toHaveBeenCalledOnce();
    const result: SubmissionError = cb.mock.calls[0][0];
    expect(result.kind).toBe("runtime_error");
    expect(result.message).toBe("Runtime Error");
    dispose();
  });

  it("fires with time_limit_exceeded kind when result is Time Limit Exceeded", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`<div data-e2e-locator="console-result">Time Limit Exceeded</div>`);
    await triggerMutation();

    expect(cb).toHaveBeenCalledOnce();
    const result: SubmissionError = cb.mock.calls[0][0];
    expect(result.kind).toBe("time_limit_exceeded");
    dispose();
  });

  it("fires with other kind for unrecognised error text", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`<div data-e2e-locator="console-result">Memory Limit Exceeded</div>`);
    await triggerMutation();

    expect(cb).toHaveBeenCalledOnce();
    const result: SubmissionError = cb.mock.calls[0][0];
    expect(result.kind).toBe("other");
    dispose();
  });

  it("does not fire again if result text has not changed", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`<div data-e2e-locator="console-result">Wrong Answer</div>`);
    await triggerMutation();
    // Trigger another mutation without changing the result text
    document.body.appendChild(document.createElement("span"));
    await triggerMutation();

    expect(cb).toHaveBeenCalledOnce();
    dispose();
  });

  it("returns a disposer that stops firing", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);
    dispose();

    setResultPanel(`<div data-e2e-locator="console-result">Wrong Answer</div>`);
    await triggerMutation();

    expect(cb).not.toHaveBeenCalled();
  });

  it("includes scraped detail with Input/Output/Expected for Wrong Answer", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`
      <div data-e2e-locator="console-result">Wrong Answer</div>
      <div class="mb-2 text-xs font-medium text-label-3">Input</div>
      <div class="font-menlo mx-3 whitespace-pre-wrap">[2,7,11,15]</div>
      <div class="flex text-xs font-medium text-label-3">Output</div>
      <div class="relative mx-3 font-menlo">[]</div>
      <div class="flex text-xs font-medium text-label-3">Expected</div>
      <div class="relative mx-3 font-menlo">[0,1]</div>
    `);
    await triggerMutation();

    const result: SubmissionError = cb.mock.calls[0][0];
    expect(result.detail).toContain("[2,7,11,15]");
    expect(result.detail).toContain("[]");
    expect(result.detail).toContain("[0,1]");
    dispose();
  });

  it("falls back to empty detail if no detail elements found", async () => {
    const cb = vi.fn();
    const dispose = onError(cb);

    setResultPanel(`<div data-e2e-locator="console-result">Runtime Error</div>`);
    await triggerMutation();

    const result: SubmissionError = cb.mock.calls[0][0];
    expect(result.detail).toBe("");
    dispose();
  });
});
