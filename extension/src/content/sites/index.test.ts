import { afterEach, describe, expect, it } from "vitest";
import { getSiteAdapter } from "./index.js";

function setHostname(hostname: string) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, hostname },
    writable: true,
  });
}

describe("getSiteAdapter", () => {
  const originalHostname = window.location.hostname;
  afterEach(() => setHostname(originalHostname));

  it("returns the LeetCode adapter on leetcode.com", () => {
    setHostname("leetcode.com");
    expect(getSiteAdapter()?.name).toBe("LeetCode");
  });

  it("returns the HackerRank adapter on www.hackerrank.com", () => {
    setHostname("www.hackerrank.com");
    expect(getSiteAdapter()?.name).toBe("HackerRank");
  });

  it("returns null on an unsupported host", () => {
    setHostname("codeforces.com");
    expect(getSiteAdapter()).toBeNull();
  });
});
