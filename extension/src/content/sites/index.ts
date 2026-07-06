import type { SiteAdapter } from "./types.js";
import { leetcodeAdapter } from "./leetcode.js";
import { hackerrankAdapter } from "./hackerrank.js";

export type { SiteAdapter, CodeExtractionResult } from "./types.js";

export function getSiteAdapter(): SiteAdapter | null {
  if (location.hostname.endsWith("leetcode.com")) return leetcodeAdapter;
  if (location.hostname.endsWith("hackerrank.com")) return hackerrankAdapter;
  return null;
}
