import { afterEach, describe, expect, it } from "vitest";
import { requestCurrentCode } from "./code.js";

const REQUEST_EVENT = "lctrainer:getCode:request";
const RESPONSE_EVENT = "lctrainer:getCode:response";

function respondOnNextRequest(detail: Record<string, unknown>) {
  const listener = (event: Event) => {
    const nonce = (event as CustomEvent).detail?.nonce;
    document.removeEventListener(REQUEST_EVENT, listener);
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: { nonce, ...detail } }));
  };
  document.addEventListener(REQUEST_EVENT, listener);
}

describe("requestCurrentCode", () => {
  afterEach(() => {
    // Drain any leftover listeners from a test that didn't get a matching response.
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: {} }));
  });

  it("resolves with a well-formed response", async () => {
    respondOnNextRequest({ code: "print(1)", language: "python", possiblyIncomplete: false });
    const result = await requestCurrentCode();
    expect(result).toEqual({ code: "print(1)", language: "python", possiblyIncomplete: false });
  });

  it("rejects a response with a non-string code field", async () => {
    respondOnNextRequest({ code: { evil: true }, language: "python", possiblyIncomplete: false });
    await expect(requestCurrentCode()).rejects.toThrow(/validation/);
  });

  it("rejects a response with code exceeding the max length", async () => {
    respondOnNextRequest({ code: "x".repeat(200_001), language: "python", possiblyIncomplete: false });
    await expect(requestCurrentCode()).rejects.toThrow(/validation/);
  });

  it("rejects a response missing possiblyIncomplete", async () => {
    respondOnNextRequest({ code: "ok", language: "python" });
    await expect(requestCurrentCode()).rejects.toThrow(/validation/);
  });

  it("ignores a response whose nonce does not match the pending request", async () => {
    document.addEventListener(
      REQUEST_EVENT,
      () => {
        document.dispatchEvent(
          new CustomEvent(RESPONSE_EVENT, {
            detail: { nonce: "wrong-nonce", code: "ok", language: "python", possiblyIncomplete: false },
          })
        );
      },
      { once: true }
    );
    await expect(requestCurrentCode(50)).rejects.toThrow(/Timed out/);
  });
});
