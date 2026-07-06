import type { ThreadEntry } from "../panel/usePanelState.js";
import { STORAGE_KEY_THREAD_CACHE } from "./constants.js";

interface CachedThread {
  entries: ThreadEntry[];
  updatedMs: number;
}

type ThreadCache = Record<string, CachedThread>;

// Bounds so a long session doesn't grow chrome.storage.local without limit:
// per-problem entries are capped (oldest dropped first) and the number of
// distinct problems cached is capped (least-recently-updated evicted first).
const MAX_ENTRIES_PER_PROBLEM = 30;
const MAX_PROBLEMS_CACHED = 40;

async function getCache(): Promise<ThreadCache> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_THREAD_CACHE);
  return stored[STORAGE_KEY_THREAD_CACHE] ?? {};
}

export async function loadThread(slug: string): Promise<ThreadEntry[] | null> {
  const cache = await getCache();
  return cache[slug]?.entries ?? null;
}

export async function saveThread(slug: string, entries: ThreadEntry[], nowMs: number): Promise<void> {
  const cache = await getCache();

  if (entries.length === 0) {
    delete cache[slug];
  } else {
    cache[slug] = { entries: entries.slice(-MAX_ENTRIES_PER_PROBLEM), updatedMs: nowMs };
  }

  const slugs = Object.keys(cache);
  if (slugs.length > MAX_PROBLEMS_CACHED) {
    slugs
      .sort((a, b) => cache[a].updatedMs - cache[b].updatedMs)
      .slice(0, slugs.length - MAX_PROBLEMS_CACHED)
      .forEach((staleSlug) => delete cache[staleSlug]);
  }

  await chrome.storage.local.set({ [STORAGE_KEY_THREAD_CACHE]: cache });
}
