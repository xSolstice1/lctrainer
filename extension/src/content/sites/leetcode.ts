import type { SiteAdapter } from "./types.js";
import { extractProblemMetadata } from "../extractors/problem.js";
import { requestCurrentCode } from "../extractors/code.js";
import { onProblemSlugChange } from "../spaNavigation.js";
import { onAccepted } from "../submissionWatcher.js";

export const leetcodeAdapter: SiteAdapter = {
  name: "LeetCode",
  extractProblem: extractProblemMetadata,
  getCurrentCode: requestCurrentCode,
  onSlugChange: onProblemSlugChange,
  onAccepted,
};
