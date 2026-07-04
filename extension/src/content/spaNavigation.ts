/**
 * LeetCode is a Next.js SPA — navigating between problems via the sidebar is
 * client-side routed and won't reload the content script. Monkey-patching
 * history.pushState/replaceState is unreliable here because the app's
 * router may hold its own reference to the native functions captured before
 * this content script ran, bypassing our wrapper entirely. Polling
 * location.pathname works regardless of how the underlying navigation
 * happens.
 */
export function onProblemSlugChange(callback: (slug: string | null) => void, pollIntervalMs = 500): () => void {
  const getSlug = () => location.pathname.match(/\/problems\/([^/]+)/)?.[1] ?? null;
  let lastSlug = getSlug();

  const check = () => {
    const slug = getSlug();
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
