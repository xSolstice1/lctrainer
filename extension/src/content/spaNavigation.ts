/** LeetCode is a Next.js SPA — navigating between problems via the sidebar is client-side routed and won't reload the content script. Patches history.pushState/replaceState and listens for popstate to detect slug changes. */
export function onProblemSlugChange(callback: (slug: string | null) => void): () => void {
  const getSlug = () => location.pathname.match(/\/problems\/([^/]+)/)?.[1] ?? null;
  let lastSlug = getSlug();

  const check = () => {
    const slug = getSlug();
    if (slug !== lastSlug) {
      lastSlug = slug;
      callback(slug);
    }
  };

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    originalPushState(...args);
    check();
  };
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    check();
  };

  window.addEventListener("popstate", check);

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", check);
  };
}
