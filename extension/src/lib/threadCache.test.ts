import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadEntry } from "../panel/usePanelState.js";
import { loadThread, saveThread } from "./threadCache.js";

function makeStorage() {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    set: vi.fn(async (obj: Record<string, unknown>) => Object.assign(store, obj)),
  };
}

function entry(question: string): ThreadEntry {
  return { question, hintLevel: 1, hintText: "answer", reasoningText: "", error: null, estimatedCostUsd: null };
}

beforeEach(() => {
  vi.stubGlobal("chrome", { storage: { local: makeStorage() } });
});

describe("threadCache", () => {
  it("returns null for a slug never saved", async () => {
    expect(await loadThread("two-sum")).toBeNull();
  });

  it("round-trips entries for a slug", async () => {
    await saveThread("two-sum", [entry("a"), entry("b")], 1000);
    expect(await loadThread("two-sum")).toEqual([entry("a"), entry("b")]);
  });

  it("deletes the slug's entry when saved with an empty thread", async () => {
    await saveThread("two-sum", [entry("a")], 1000);
    await saveThread("two-sum", [], 2000);
    expect(await loadThread("two-sum")).toBeNull();
  });

  it("keeps separate slugs independent", async () => {
    await saveThread("two-sum", [entry("a")], 1000);
    await saveThread("three-sum", [entry("b")], 1000);
    expect(await loadThread("two-sum")).toEqual([entry("a")]);
    expect(await loadThread("three-sum")).toEqual([entry("b")]);
  });

  it("caps entries per problem, dropping the oldest", async () => {
    const many = Array.from({ length: 35 }, (_, i) => entry(`q${i}`));
    await saveThread("two-sum", many, 1000);
    const loaded = await loadThread("two-sum");
    expect(loaded).toHaveLength(30);
    expect(loaded?.[0].question).toBe("q5");
    expect(loaded?.[loaded.length - 1].question).toBe("q34");
  });

  it("evicts the least-recently-updated problem once over the cap", async () => {
    for (let i = 0; i < 41; i++) {
      await saveThread(`problem-${i}`, [entry("q")], i);
    }
    expect(await loadThread("problem-0")).toBeNull();
    expect(await loadThread("problem-40")).toEqual([entry("q")]);
  });
});
