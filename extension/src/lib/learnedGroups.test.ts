import { describe, expect, it } from "vitest";
import type { ProblemRecord } from "./solveHistory.js";
import { computeDayStreak, computeWeakTags, groupSolvedByPattern } from "./learnedGroups.js";

function record(overrides: Partial<ProblemRecord>): ProblemRecord {
  return {
    slug: "slug",
    title: "Title",
    difficulty: "Easy",
    tags: [],
    hintCount: 0,
    firstSeenMs: 0,
    lastSeenMs: 0,
    acceptedMs: null,
    ...overrides,
  };
}

describe("groupSolvedByPattern", () => {
  it("only includes accepted problems", () => {
    const records = [
      record({ slug: "a", tags: ["Dynamic Programming"], acceptedMs: 1000 }),
      record({ slug: "b", tags: ["Dynamic Programming"], acceptedMs: null }),
    ];
    const groups = groupSolvedByPattern(records);
    expect(groups).toEqual([{ tag: "Dynamic Programming", problems: [records[0]] }]);
  });

  it("buckets a problem under every matching pattern tag", () => {
    const records = [record({ slug: "a", tags: ["Two Pointers", "Sliding Window", "Array"], acceptedMs: 1000 })];
    const groups = groupSolvedByPattern(records);
    expect(groups.map((g) => g.tag).sort()).toEqual(["Sliding Window", "Two Pointers"]);
  });

  it("buckets problems with no recognized pattern tag under Other", () => {
    const records = [record({ slug: "a", tags: ["Array", "Hash Table"], acceptedMs: 1000 })];
    expect(groupSolvedByPattern(records)).toEqual([{ tag: "Other", problems: [records[0]] }]);
  });

  it("sorts groups by problem count descending, then tag name", () => {
    const records = [
      record({ slug: "a", title: "A", tags: ["Greedy"], acceptedMs: 1000 }),
      record({ slug: "b", title: "B", tags: ["Backtracking"], acceptedMs: 1000 }),
      record({ slug: "c", title: "C", tags: ["Backtracking"], acceptedMs: 1000 }),
    ];
    const groups = groupSolvedByPattern(records);
    expect(groups.map((g) => g.tag)).toEqual(["Backtracking", "Greedy"]);
  });

  it("sorts problems within a group by difficulty then title", () => {
    const records = [
      record({ slug: "a", title: "Zeta", difficulty: "Easy", tags: ["Greedy"], acceptedMs: 1000 }),
      record({ slug: "b", title: "Alpha", difficulty: "Hard", tags: ["Greedy"], acceptedMs: 1000 }),
      record({ slug: "c", title: "Beta", difficulty: "Easy", tags: ["Greedy"], acceptedMs: 1000 }),
    ];
    const [group] = groupSolvedByPattern(records);
    expect(group.problems.map((p) => p.title)).toEqual(["Beta", "Zeta", "Alpha"]);
  });
});

describe("computeWeakTags", () => {
  it("ranks tags by average hints per solved problem, descending", () => {
    const records = [
      record({ slug: "a", tags: ["DP"], hintCount: 4, acceptedMs: 1000 }),
      record({ slug: "b", tags: ["Greedy"], hintCount: 1, acceptedMs: 1000 }),
    ];
    const weak = computeWeakTags(records);
    expect(weak[0].tag).toBe("DP");
    expect(weak[0].avgHints).toBe(4);
  });

  it("excludes tags with zero average hints", () => {
    const records = [record({ slug: "a", tags: ["Greedy"], hintCount: 0, acceptedMs: 1000 })];
    expect(computeWeakTags(records)).toEqual([]);
  });

  it("ignores unsolved problems", () => {
    const records = [record({ slug: "a", tags: ["DP"], hintCount: 5, acceptedMs: null })];
    expect(computeWeakTags(records)).toEqual([]);
  });
});

describe("computeDayStreak", () => {
  const now = new Date("2026-07-06T12:00:00Z");

  it("returns 0 with no accepted problems", () => {
    expect(computeDayStreak([record({ acceptedMs: null })], now)).toBe(0);
  });

  it("counts consecutive accepted days back from today", () => {
    const today = new Date("2026-07-06T09:00:00Z").getTime();
    const yesterday = new Date("2026-07-05T09:00:00Z").getTime();
    const records = [record({ slug: "a", acceptedMs: today }), record({ slug: "b", acceptedMs: yesterday })];
    expect(computeDayStreak(records, now)).toBe(2);
  });

  it("stops at the first gap day", () => {
    const today = new Date("2026-07-06T09:00:00Z").getTime();
    const twoDaysAgo = new Date("2026-07-04T09:00:00Z").getTime();
    const records = [record({ slug: "a", acceptedMs: today }), record({ slug: "b", acceptedMs: twoDaysAgo })];
    expect(computeDayStreak(records, now)).toBe(1);
  });
});
