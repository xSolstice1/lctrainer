const REQUEST_EVENT = "lctrainer:getCode:request";
const RESPONSE_EVENT = "lctrainer:getCode:response";

interface CodeExtractionResult {
  code: string;
  language: string;
  possiblyIncomplete: boolean;
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
