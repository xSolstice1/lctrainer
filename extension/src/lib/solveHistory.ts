import { STORAGE_KEY_SOLVE_HISTORY } from "./constants.js";

export interface ProblemRecord {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  hintCount: number;
  firstSeenMs: number;
  lastSeenMs: number;
  acceptedMs: number | null;
}

export type SolveHistory = Record<string, ProblemRecord>;

export async function getSolveHistory(): Promise<SolveHistory> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_SOLVE_HISTORY);
  return stored[STORAGE_KEY_SOLVE_HISTORY] ?? {};
}

async function updateHistory(mutate: (history: SolveHistory) => void): Promise<void> {
  const history = await getSolveHistory();
  mutate(history);
  await chrome.storage.local.set({ [STORAGE_KEY_SOLVE_HISTORY]: history });
}

function ensureRecord(
  history: SolveHistory,
  problem: { slug: string; title: string; difficulty: "Easy" | "Medium" | "Hard"; tags: string[] },
  nowMs: number
): ProblemRecord {
  const existing = history[problem.slug];
  if (existing) {
    existing.lastSeenMs = nowMs;
    existing.title = problem.title;
    existing.tags = problem.tags;
    return existing;
  }
  const record: ProblemRecord = {
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    tags: problem.tags,
    hintCount: 0,
    firstSeenMs: nowMs,
    lastSeenMs: nowMs,
    acceptedMs: null,
  };
  history[problem.slug] = record;
  return record;
}

export async function recordProblemSeen(
  problem: { slug: string; title: string; difficulty: "Easy" | "Medium" | "Hard"; tags: string[] },
  nowMs: number
): Promise<void> {
  await updateHistory((history) => ensureRecord(history, problem, nowMs));
}

export async function recordHintUsed(
  problem: { slug: string; title: string; difficulty: "Easy" | "Medium" | "Hard"; tags: string[] },
  nowMs: number
): Promise<void> {
  await updateHistory((history) => {
    ensureRecord(history, problem, nowMs).hintCount += 1;
  });
}

export async function recordAccepted(
  problem: { slug: string; title: string; difficulty: "Easy" | "Medium" | "Hard"; tags: string[] },
  nowMs: number
): Promise<void> {
  await updateHistory((history) => {
    const record = ensureRecord(history, problem, nowMs);
    if (record.acceptedMs === null) record.acceptedMs = nowMs;
  });
}
