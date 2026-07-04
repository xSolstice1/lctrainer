import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "lctrainer — Live LeetCode AI Trainer",
  version: "0.1.0",
  description: "Socratic AI hints for your live LeetCode code, powered by AWS Bedrock or OpenRouter.",
  permissions: ["storage"],
  host_permissions: ["https://leetcode.com/*"],
  background: {
    service_worker: "src/background/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://leetcode.com/problems/*"],
      js: ["src/content/content.ts"],
      run_at: "document_idle",
    },
    {
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
