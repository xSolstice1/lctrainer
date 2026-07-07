import type { Difficulty, ProblemMetadata, SubmissionError } from "@lctrainer/shared";
import type { SiteAdapter } from "./types.js";

/**
 * HackerRank adapter — proves the SiteAdapter abstraction with a second,
 * genuinely different extraction strategy (DOM-only, no GraphQL API and no
 * MAIN-world Monaco bridge like LeetCode's). NOT YET VERIFIED against a live
 * hackerrank.com page — selectors below are best-effort based on
 * HackerRank's general challenge-page structure and may need adjustment.
 * Every path degrades gracefully (null/empty) rather than throwing, same
 * policy as the LeetCode extractors.
 */

function getSlugFromPath(): string | null {
  const match = location.pathname.match(/\/challenges\/([^/]+)/);
  return match?.[1] ?? null;
}

async function extractProblem(): Promise<ProblemMetadata | null> {
  const slug = getSlugFromPath();
  if (!slug) return null;

  const title = document.querySelector<HTMLElement>("h1")?.textContent?.trim() ?? slug;
  const statementHtml = document.querySelector<HTMLElement>(".problem-statement, [class*='problem-statement']")
    ?.innerHTML ?? "";
  const tags = Array.from(document.querySelectorAll<HTMLElement>("[class*='challenge-tag'], .tag-name"))
    .map((el) => el.textContent?.trim())
    .filter((t): t is string => Boolean(t));

  return {
    slug,
    title,
    // HackerRank doesn't expose a normalized Easy/Medium/Hard label in the
    // same way LeetCode does on every challenge type — default to Medium
    // rather than guessing from inconsistent page text.
    difficulty: "Medium" as Difficulty,
    tags,
    statementHtml,
  };
}

async function getCurrentCode(): Promise<{ code: string; language: string; possiblyIncomplete: boolean }> {
  // CodeMirror (HackerRank's editor) renders visible lines as .CodeMirror-line
  // spans, same virtualized-viewport caveat as LeetCode's Monaco DOM fallback:
  // scrolled-out lines are missing from this reconstruction.
  const lines = document.querySelectorAll<HTMLElement>(".CodeMirror-line");
  const code = Array.from(lines)
    .map((el) => el.textContent ?? "")
    .join("\n");

  const language =
    document.querySelector<HTMLSelectElement>("select[class*='language']")?.value?.trim() ?? "unknown";

  return { code, language, possiblyIncomplete: lines.length > 0 };
}

function onSlugChange(callback: (slug: string | null) => void, pollIntervalMs = 500): () => void {
  let lastSlug = getSlugFromPath();
  const check = () => {
    const slug = getSlugFromPath();
    if (slug !== lastSlug) {
      lastSlug = slug;
      callback(slug);
    }
  };
  const intervalId = setInterval(check, pollIntervalMs);
  window.addEventListener("popstate", check);
  return () => {
    clearInterval(intervalId);
    window.removeEventListener("popstate", check);
  };
}

function onAccepted(callback: () => void): () => void {
  let lastSeenText: string | null = null;
  const check = () => {
    const el = document.querySelector<HTMLElement>("[class*='result-message'], [class*='submission-status']");
    const text = el?.textContent?.trim() ?? null;
    if (text !== lastSeenText) {
      lastSeenText = text;
      if (text && /accepted|success/i.test(text)) callback();
    }
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

// HackerRank's result panel structure is unverified — stubbed with a no-op
// disposer until selectors are confirmed against a live page.
function onError(_callback: (error: SubmissionError) => void): () => void {
  return () => {};
}

export const hackerrankAdapter: SiteAdapter = {
  name: "HackerRank",
  extractProblem,
  getCurrentCode,
  onSlugChange,
  onAccepted,
  onError,
};
