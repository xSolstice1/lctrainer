const DEFAULT_TIMEOUT_MS = 8000;

/** Same as fetch, but rejects with an AbortError if the server doesn't respond in time. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signal = init.signal
    ? anySignal([init.signal, timeoutController.signal])
    : timeoutController.signal;

  return fetch(url, { ...init, signal }).finally(() => clearTimeout(timer));
}

/** AbortError from fetchWithTimeout gives no hint it was a timeout — this turns it into a readable message. */
export function describeFetchError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") return "Server did not respond in time";
  return err instanceof Error ? err.message : "Failed to reach server";
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}
