import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSolveHistory, recordAccepted, recordHintUsed, recordProblemSeen } from "./solveHistory.js";

function makeStorage() {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    set: vi.fn(async (obj: Record<string, unknown>) => Object.assign(store, obj)),
  };
}

const PROBLEM = { slug: "two-sum", title: "Two Sum", difficulty: "Easy" as const, tags: ["Array", "Hash Table"] };

beforeEach(() => {
  vi.stubGlobal("chrome", { storage: { local: makeStorage() } });
});

describe("solveHistory", () => {
  it("creates a record on first sight with hintCount 0 and acceptedMs null", async () => {
    await recordProblemSeen(PROBLEM, 1000);
    const history = await getSolveHistory();
    expect(history["two-sum"]).toMatchObject({
      slug: "two-sum",
      title: "Two Sum",
      hintCount: 0,
      firstSeenMs: 1000,
      lastSeenMs: 1000,
      acceptedMs: null,
    });
  });

  it("updates lastSeenMs but not firstSeenMs on repeat sightings", async () => {
    await recordProblemSeen(PROBLEM, 1000);
    await recordProblemSeen(PROBLEM, 2000);
    const history = await getSolveHistory();
    expect(history["two-sum"].firstSeenMs).toBe(1000);
    expect(history["two-sum"].lastSeenMs).toBe(2000);
  });

  it("increments hintCount on each recordHintUsed call", async () => {
    await recordHintUsed(PROBLEM, 1000);
    await recordHintUsed(PROBLEM, 1500);
    const history = await getSolveHistory();
    expect(history["two-sum"].hintCount).toBe(2);
  });

  it("sets acceptedMs on first accept and does not overwrite it on a later accept", async () => {
    await recordAccepted(PROBLEM, 1000);
    await recordAccepted(PROBLEM, 5000);
    const history = await getSolveHistory();
    expect(history["two-sum"].acceptedMs).toBe(1000);
  });

  it("tracks separate problems independently", async () => {
    await recordProblemSeen(PROBLEM, 1000);
    await recordProblemSeen({ ...PROBLEM, slug: "three-sum", title: "3Sum" }, 2000);
    const history = await getSolveHistory();
    expect(Object.keys(history).sort()).toEqual(["three-sum", "two-sum"]);
  });
});
