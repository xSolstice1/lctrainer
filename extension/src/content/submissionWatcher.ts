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
