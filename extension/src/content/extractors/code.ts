const REQUEST_EVENT = "lctrainer:getCode:request";
const RESPONSE_EVENT = "lctrainer:getCode:response";

interface CodeExtractionResult {
  code: string;
  language: string;
  possiblyIncomplete: boolean;
}

// LeetCode solutions run well under this; a payload past it is more likely a
// malformed/spoofed response than real editor content, so reject outright
// rather than shipping garbage off to the LLM.
const MAX_CODE_LENGTH = 200_000;

/**
 * Validates a monacoBridge response payload before trusting it. The
 * REQUEST_EVENT/RESPONSE_EVENT CustomEvents are visible to any script
 * sharing this page (document-scoped, no sender authentication is possible
 * across the isolated/MAIN world boundary) — this can't stop a malicious
 * script from answering instead of the real bridge, but it does stop a
 * malformed/oversized payload from being trusted as code.
 */
function isValidResponsePayload(detail: any): detail is CodeExtractionResult {
  return (
    typeof detail?.code === "string" &&
    detail.code.length <= MAX_CODE_LENGTH &&
    typeof detail?.language === "string" &&
    detail.language.length <= 100 &&
    typeof detail?.possiblyIncomplete === "boolean"
  );
}

/** Requests the current code from monacoBridge.ts (running in the MAIN world) via a nonce-correlated CustomEvent round-trip. */
export function requestCurrentCode(timeoutMs = 2000): Promise<CodeExtractionResult> {
  const nonce = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      document.removeEventListener(RESPONSE_EVENT, onResponse);
      reject(new Error("Timed out waiting for monacoBridge response"));
    }, timeoutMs);

    function onResponse(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (detail?.nonce !== nonce) return;
      clearTimeout(timer);
      document.removeEventListener(RESPONSE_EVENT, onResponse);
      if (!isValidResponsePayload(detail)) {
        reject(new Error("monacoBridge response failed validation"));
        return;
      }
      resolve({
        code: detail.code,
        language: detail.language,
        possiblyIncomplete: detail.possiblyIncomplete,
      });
    }

    document.addEventListener(RESPONSE_EVENT, onResponse);
    document.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: { nonce } }));
  });
}
