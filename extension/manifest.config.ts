import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Leetcode Trainer — Live AI Trainer",
  version: "0.2.0",
  description: "Socratic AI hints for your live LeetCode code, powered by a local model (Ollama), AWS Bedrock, or OpenRouter.",
  permissions: ["storage"],
  host_permissions: ["https://leetcode.com/*", "https://www.hackerrank.com/*"],
  commands: {
    "request-hint": {
      suggested_key: { default: "Alt+H" },
      description: "Get a hint on the current LeetCode problem",
    },
    "explain-error": {
      suggested_key: { default: "Alt+E" },
      description: "Explain the current submission error",
    },
  },
  background: {
    service_worker: "src/background/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://leetcode.com/problems/*", "https://www.hackerrank.com/challenges/*"],
      js: ["src/content/content.ts"],
      run_at: "document_idle",
    },
    {
      // LeetCode-only: exposes window.monaco in the MAIN world so the
      // isolated-world content script can read the editor's real model
      // instead of scraping virtualized DOM lines. HackerRank's adapter has
      // no equivalent bridge yet — see hackerrank.ts's getCurrentCode.
      matches: ["https://leetcode.com/problems/*"],
      js: ["src/content/monacoBridge.ts"],
      world: "MAIN",
      run_at: "document_idle",
    },
  ],
  options_ui: {
    page: "src/options/options.html",
    open_in_tab: true,
  },
  // TODO: add icons (16/48/128px) before shipping; omitted for MVP scaffold.
});
