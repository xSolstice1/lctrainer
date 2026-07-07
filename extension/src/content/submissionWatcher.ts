import type { SubmissionError, SubmissionErrorKind } from "@lctrainer/shared";

/**
 * Detects an "Accepted" submission result so the panel can offer a
 * post-solve review. LeetCode's result panel exposes
 * data-e2e-locator="submission-result" with textContent "Accepted" on
 * success — this selector is used by several existing LeetCode tooling
 * projects, but NOT yet verified against the current live DOM by this
 * codebase (same caveat as monacoBridge.ts). Missing a real acceptance is a
 * worse failure mode than an occasional false negative, so this only fires
 * on an exact "Accepted" match rather than guessing more broadly.
 */
const RESULT_SELECTOR = '[data-e2e-locator="submission-result"]';

export function onAccepted(callback: () => void): () => void {
  let lastSeenText: string | null = null;

  const check = () => {
    const el = document.querySelector<HTMLElement>(RESULT_SELECTOR);
    const text = el?.textContent?.trim() ?? null;
    if (text !== lastSeenText) {
      lastSeenText = text;
      if (text && /^Accepted$/i.test(text)) callback();
    }
  };

  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  return () => observer.disconnect();
}

/**
 * Detects non-Accepted submission results from LeetCode's live console result
 * panel (data-e2e-locator="console-result") and scrapes available detail.
 *
 * Selector verified against the live DOM on 2026-07-07. Detail scraping uses
 * text-label class matching with graceful fallback to empty string if the
 * structure changes.
 */
const CONSOLE_RESULT_SELECTOR = '[data-e2e-locator="console-result"]';

function classifyKind(text: string): SubmissionErrorKind {
  if (/wrong\s+answer/i.test(text)) return "wrong_answer";
  if (/runtime\s+error/i.test(text)) return "runtime_error";
  if (/time\s+limit\s+exceeded/i.test(text)) return "time_limit_exceeded";
  return "other";
}

function scrapeDetail(): string {
  // Find all label-3 text nodes and pair them with the next font-menlo sibling.
  // This covers the Input/Output/Expected blocks in the Wrong Answer panel.
  const labelEls = document.querySelectorAll<HTMLElement>(".text-label-3, .dark\\:text-dark-label-3");
  const parts: string[] = [];

  for (const label of labelEls) {
    const labelText = label.textContent?.trim();
    if (!labelText || !["Input", "Output", "Expected"].includes(labelText)) continue;

    // Walk siblings to find the nearest font-menlo value element
    let sibling = label.nextElementSibling;
    while (sibling) {
      if (sibling.className && typeof sibling.className === "string" && sibling.className.includes("font-menlo")) {
        const value = sibling.textContent?.trim();
        if (value) parts.push(`${labelText}: ${value}`);
        break;
      }
      sibling = sibling.nextElementSibling;
    }
  }

  return parts.join("\n");
}

export function onError(callback: (error: SubmissionError) => void): () => void {
  let lastSeenText: string | null = null;

  const check = () => {
    const el = document.querySelector<HTMLElement>(CONSOLE_RESULT_SELECTOR);
    const text = el?.textContent?.trim() ?? null;
    if (text === lastSeenText) return;
    lastSeenText = text;

    if (!text || /^Accepted$/i.test(text)) return;

    const kind = classifyKind(text);
    const detail = scrapeDetail();
    callback({ kind, message: text, detail });
  };

  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  return () => observer.disconnect();
}
