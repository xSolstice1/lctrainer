import type { BackgroundToContentMessage, ProblemMetadata } from "@lctrainer/shared";
import { connectToBackground } from "../lib/messaging.js";
import { extractProblemMetadata } from "./extractors/problem.js";
import { requestCurrentCode } from "./extractors/code.js";
import { onProblemSlugChange } from "./spaNavigation.js";
import { mountPanel } from "../panel/mount.js";
import { STORAGE_KEY_MODEL_ID, STORAGE_KEY_PROVIDER } from "../lib/constants.js";

const PING_INTERVAL_MS = 20_000;

async function main() {
  const sessionId = crypto.randomUUID();

  let currentProblem: ProblemMetadata | null = null;
  let port: chrome.runtime.Port;
  let activeRequestId: string | null = null;

  const stored = await chrome.storage.local.get([STORAGE_KEY_PROVIDER, STORAGE_KEY_MODEL_ID]);

  const panel = mountPanel({
    initialProviderId: stored[STORAGE_KEY_PROVIDER] ?? "",
    initialModelId: stored[STORAGE_KEY_MODEL_ID] ?? "",

    onRequestHint: async ({ userQuestion, allowFullSolution, provider, modelId }) => {
      const code = await requestCurrentCode().catch(() => ({
        code: "",
        language: "unknown",
        possiblyIncomplete: true,
      }));

      if (currentProblem) {
        const requestId = crypto.randomUUID();
        activeRequestId = requestId;
        port.postMessage({
          type: "requestGuidance",
          request: {
            sessionId,
            requestId,
            problem: currentProblem,
            code: {
              language: code.language,
              code: code.code,
              timestampMs: Date.now(),
              possiblyIncomplete: code.possiblyIncomplete,
            },
            userQuestion,
            allowFullSolution,
            provider,
            modelId,
          },
        });
      }

      return { codeCaptureIncomplete: code.possiblyIncomplete };
    },

    onProviderChange: (providerId) => {
      chrome.storage.local.set({ [STORAGE_KEY_PROVIDER]: providerId });
    },

    onModelChange: (modelId) => {
      chrome.storage.local.set({ [STORAGE_KEY_MODEL_ID]: modelId });
    },

    onRequestServerInfo: () => {
      port.postMessage({ type: "requestServerInfo" });
    },
  });

  function handleMessage(message: BackgroundToContentMessage) {
    if (message.type === "guidanceChunk") {
      if (message.requestId !== activeRequestId) return; // stale/superseded stream
      if (message.chunk.type === "done" || message.chunk.type === "error") activeRequestId = null;
      panel.onGuidanceChunk(message.chunk);
    } else if (message.type === "connectionError") {
      if (message.requestId !== activeRequestId) return;
      activeRequestId = null;
      panel.onConnectionError(message.message);
    } else if (message.type === "serverInfo") {
      panel.onServerInfoLoaded(message.config, message.modelsByProvider);
    } else if (message.type === "serverInfoError") {
      panel.onServerInfoFailed(message.message);
    }
    // "pong" needs no handling — receiving it just confirms the port is alive.
  }

  function connect() {
    port = connectToBackground();
    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(() => {
      // The background service worker was terminated (MV3 idle timeout,
      // extension reload, etc). Surface it if a request was in flight so the
      // panel doesn't stay stuck on "Thinking...", then reconnect immediately
      // rather than leaving the panel permanently disconnected.
      if (activeRequestId) {
        panel.onConnectionError("Lost connection to the extension background worker. Please try again.");
        activeRequestId = null;
      }
      connect();
    });
  }

  connect();

  // MV3 service workers are killed by Chrome after ~30s of port
  // inactivity, even with the port still open — a periodic message resets
  // that idle timer so the worker (and the guidance pipeline) survives
  // things like alt-tabbing away from the page for a while.
  setInterval(() => {
    try {
      port.postMessage({ type: "ping" });
    } catch {
      // Port was already disconnected; onDisconnect will trigger reconnect.
    }
  }, PING_INTERVAL_MS);

  async function loadProblem() {
    currentProblem = await extractProblemMetadata();
    panel.onProblemLoaded(currentProblem);
  }

  loadProblem();
  onProblemSlugChange(() => loadProblem());

  console.log("[lctrainer] content script loaded on", location.pathname);
}

main();
