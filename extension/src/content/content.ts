import type { BackgroundToContentMessage, ProblemMetadata } from "@lctrainer/shared";
import { connectToBackground } from "../lib/messaging.js";
import { extractProblemMetadata } from "./extractors/problem.js";
import { requestCurrentCode } from "./extractors/code.js";
import { onProblemSlugChange } from "./spaNavigation.js";
import { mountPanel } from "../panel/mount.js";
import { STORAGE_KEY_MODEL_ID } from "../lib/constants.js";

async function main() {
  const sessionId = crypto.randomUUID();
  const port = connectToBackground();

  let currentProblem: ProblemMetadata | null = null;

  const stored = await chrome.storage.local.get(STORAGE_KEY_MODEL_ID);

  const panel = mountPanel({
    initialModelId: stored[STORAGE_KEY_MODEL_ID] ?? "",

    onRequestHint: async ({ userQuestion, modelId }) => {
      const code = await requestCurrentCode().catch(() => ({
        code: "",
        language: "unknown",
        possiblyIncomplete: true,
      }));

      if (currentProblem) {
        port.postMessage({
          type: "requestGuidance",
          request: {
            sessionId,
            problem: currentProblem,
            code: {
              language: code.language,
              code: code.code,
              timestampMs: Date.now(),
              possiblyIncomplete: code.possiblyIncomplete,
            },
            userQuestion,
            modelId,
          },
        });
      }

      return { codeCaptureIncomplete: code.possiblyIncomplete };
    },

    onModelChange: (modelId) => {
      chrome.storage.local.set({ [STORAGE_KEY_MODEL_ID]: modelId });
    },

    onRequestServerInfo: () => {
      port.postMessage({ type: "requestServerInfo" });
    },
  });

  port.onMessage.addListener((message: BackgroundToContentMessage) => {
    if (message.type === "guidanceChunk") {
      panel.onGuidanceChunk(message.chunk);
    } else if (message.type === "connectionError") {
      panel.onConnectionError(message.message);
    } else if (message.type === "serverInfo") {
      panel.onServerInfoLoaded(message.config, message.models);
    } else if (message.type === "serverInfoError") {
      panel.onServerInfoFailed(message.message);
    }
  });

  port.onDisconnect.addListener(() => {
    panel.onConnectionError("Disconnected from background worker — reload the page to reconnect.");
  });

  async function loadProblem() {
    currentProblem = await extractProblemMetadata();
    panel.onProblemLoaded(currentProblem);
  }

  loadProblem();
  onProblemSlugChange(() => loadProblem());

  console.log("[lctrainer] content script loaded on", location.pathname);
}

main();
