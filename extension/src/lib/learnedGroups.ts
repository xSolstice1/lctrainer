import type { ProblemRecord } from "./solveHistory.js";
import { PATTERN_TAGS } from "./patternTags.js";

const DIFFICULTY_ORDER: Record<ProblemRecord["difficulty"], number> = { Easy: 0, Medium: 1, Hard: 2 };

export function computeDayStreak(records: ProblemRecord[], now = new Date()): number {
  const acceptedDays = new Set(
    records.filter((r) => r.acceptedMs !== null).map((r) => new Date(r.acceptedMs!).toDateString())
  );
  if (acceptedDays.size === 0) return 0;

  let streak = 0;
  const cursor = new Date(now);
  while (acceptedDays.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeWeakTags(
  records: ProblemRecord[],
  limit = 5
): { tag: string; avgHints: number; count: number }[] {
  const byTag = new Map<string, { totalHints: number; count: number }>();
  for (const r of records) {
    if (r.acceptedMs === null) continue;
    for (const tag of r.tags) {
      const bucket = byTag.get(tag) ?? { totalHints: 0, count: 0 };
      bucket.totalHints += r.hintCount;
      bucket.count += 1;
      byTag.set(tag, bucket);
    }
  }
  return Array.from(byTag.entries())
    .map(([tag, { totalHints, count }]) => ({ tag, avgHints: totalHints / count, count }))
    .filter((t) => t.avgHints > 0)
    .sort((a, b) => b.avgHints - a.avgHints)
    .slice(0, limit);
}

/** Groups solved problems by algorithmic pattern tag (LeetCode's own topicTags filtered to PATTERN_TAGS); problems with no recognized pattern land in "Other". A problem with multiple pattern tags appears under each. */
export function groupSolvedByPattern(records: ProblemRecord[]): { tag: string; problems: ProblemRecord[] }[] {
  const solved = records.filter((r) => r.acceptedMs !== null);
  const byTag = new Map<string, ProblemRecord[]>();

  for (const r of solved) {
    const patternTags = r.tags.filter((t) => PATTERN_TAGS.has(t));
    const groups = patternTags.length > 0 ? patternTags : ["Other"];
    for (const tag of groups) {
      const bucket = byTag.get(tag) ?? [];
      bucket.push(r);
      byTag.set(tag, bucket);
    }
  }

  return Array.from(byTag.entries())
    .map(([tag, problems]) => ({
      tag,
      problems: [...problems].sort(
        (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] || a.title.localeCompare(b.title)
      ),
    }))
    .sort((a, b) => b.problems.length - a.problems.length || a.tag.localeCompare(b.tag));
}
