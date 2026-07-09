import type { BackgroundToContentMessage, ConversationTurn, ProblemMetadata, SubmissionError } from "@lctrainer/shared";
import { connectToBackground } from "../lib/messaging.js";
import { getSiteAdapter, type SiteAdapter } from "./sites/index.js";
import { mountPanel } from "../panel/mount.js";
import { STORAGE_KEY_MODEL_ID, STORAGE_KEY_PROVIDER } from "../lib/constants.js";
import { recordAccepted, recordHintUsed, recordProblemSeen } from "../lib/solveHistory.js";

const PING_INTERVAL_MS = 20_000;
// Keep the last 3 exchanges (6 turns) — enough for follow-up context without
// letting the prompt grow unbounded across a long session.
const MAX_HISTORY_TURNS = 6;

async function main() {
  const detectedSite = getSiteAdapter();
  if (!detectedSite) return; // manifest match patterns should prevent this, but guard anyway
  const site: SiteAdapter = detectedSite;

  const sessionId = crypto.randomUUID();

  let currentProblem: ProblemMetadata | null = null;
  let port: chrome.runtime.Port;
  let activeRequestId: string | null = null;
  let history: ConversationTurn[] = [];
  let pendingAssistantText = "";
  let lastHintCode: string | null = null;
  let lastSubmissionError: SubmissionError | null = null;
  // Interview mode keeps its own conversation history, separate from the
  // learn-mode thread above — it's a different persona/context entirely.
  let interviewHistory: ConversationTurn[] = [];
  let pendingInterviewText = "";
  // Only one request is ever in flight (shared activeRequestId below) — this
  // says which history/pending-buffer the in-flight response belongs to.
  let activeRequestMode: "learn" | "interview" = "learn";

  const stored = await chrome.storage.local.get([STORAGE_KEY_PROVIDER, STORAGE_KEY_MODEL_ID]);

  const panel = mountPanel({
    initialProviderId: stored[STORAGE_KEY_PROVIDER] ?? "",
    initialModelId: stored[STORAGE_KEY_MODEL_ID] ?? "",

    onRequestHint: async ({ userQuestion, hintLevel, provider, modelId, submissionError }) => {
      let codeCaptureFailureReason: string | undefined;
      const code = await site.getCurrentCode().catch((err: Error) => {
        codeCaptureFailureReason = err.message.startsWith("Timed out")
          ? "The code editor didn't respond in time"
          : "The captured code failed validation";
        return { code: "", language: "unknown", possiblyIncomplete: true };
      });

      if (currentProblem) {
        const requestId = crypto.randomUUID();
        activeRequestId = requestId;
        activeRequestMode = "learn";
        pendingAssistantText = "";
        const codeChangedSinceLastHint = history.length > 0 && lastHintCode !== null && code.code !== lastHintCode;
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
            history,
            hintLevel,
            codeChangedSinceLastHint,
            provider,
            modelId,
            submissionError,
          },
        });
        history = [...history, { role: "user", content: userQuestion || "(requested a hint on the current code)" }];
        lastHintCode = code.code;
        recordHintUsed(currentProblem, Date.now());
      }

      if (code.possiblyIncomplete && !codeCaptureFailureReason) {
        codeCaptureFailureReason = "Some scrolled-out lines may be missing (the editor's structured API wasn't available)";
      }
      return { codeCaptureIncomplete: code.possiblyIncomplete, codeCaptureFailureReason };
    },

    onRequestInterviewTurn: async ({ userQuestion, interviewLevel, pressureLevel, interviewPhase, provider, modelId }) => {
      let codeCaptureFailureReason: string | undefined;
      const code = await site.getCurrentCode().catch((err: Error) => {
        codeCaptureFailureReason = err.message.startsWith("Timed out")
          ? "The code editor didn't respond in time"
          : "The captured code failed validation";
        return { code: "", language: "unknown", possiblyIncomplete: true };
      });

      if (currentProblem) {
        const requestId = crypto.randomUUID();
        activeRequestId = requestId;
        activeRequestMode = "interview";
        pendingInterviewText = "";
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
            history: interviewHistory,
            mode: "interview",
            interviewLevel,
            pressureLevel,
            interviewPhase,
            provider,
            modelId,
          },
        });
        if (userQuestion) interviewHistory = [...interviewHistory, { role: "user", content: userQuestion }];
      }

      if (code.possiblyIncomplete && !codeCaptureFailureReason) {
        codeCaptureFailureReason = "Some scrolled-out lines may be missing (the editor's structured API wasn't available)";
      }
      return { codeCaptureIncomplete: code.possiblyIncomplete, codeCaptureFailureReason };
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

    onRequestAwsProfiles: () => {
      port.postMessage({ type: "requestAwsProfiles" });
    },

    onCancelHint: () => {
      if (activeRequestId) {
        port.postMessage({ type: "cancelGuidance", requestId: activeRequestId });
      }
    },
  });

  function handleMessage(message: BackgroundToContentMessage) {
    if (message.type === "guidanceChunk") {
      if (message.requestId !== activeRequestId) return; // stale/superseded stream
      const isInterview = activeRequestMode === "interview";
      if (message.chunk.type === "token") {
        if (isInterview) pendingInterviewText += message.chunk.delta;
        else pendingAssistantText += message.chunk.delta;
      }
      if (message.chunk.type === "done") {
        activeRequestId = null;
        if (isInterview) {
          if (pendingInterviewText) {
            interviewHistory = [...interviewHistory, { role: "assistant", content: pendingInterviewText }];
          }
        } else if (pendingAssistantText) {
          const turn: ConversationTurn = { role: "assistant", content: pendingAssistantText };
          history = [...history, turn].slice(-MAX_HISTORY_TURNS);
        }
      }
      if (message.chunk.type === "error") {
        activeRequestId = null;
        // drop the user turn we optimistically recorded; no assistant reply followed
        if (isInterview) interviewHistory = interviewHistory.slice(0, -1);
        else history = history.slice(0, -1);
      }
      if (isInterview) panel.onInterviewChunk(message.chunk);
      else panel.onGuidanceChunk(message.chunk);
    } else if (message.type === "connectionError") {
      if (message.requestId !== activeRequestId) return;
      activeRequestId = null;
      if (activeRequestMode === "interview") {
        interviewHistory = interviewHistory.slice(0, -1);
        panel.onInterviewConnectionError(message.message);
      } else {
        history = history.slice(0, -1);
        panel.onConnectionError(message.message);
      }
    } else if (message.type === "guidanceCancelled") {
      if (message.requestId !== activeRequestId) return;
      activeRequestId = null;
      if (activeRequestMode === "interview") {
        interviewHistory = interviewHistory.slice(0, -1);
        panel.onInterviewCancelled();
      } else {
        history = history.slice(0, -1);
        panel.onGuidanceCancelled();
      }
    } else if (message.type === "serverInfo") {
      panel.onServerInfoLoaded(message.config, message.modelsByProvider);
    } else if (message.type === "serverInfoError") {
      panel.onServerInfoFailed(message.message);
    } else if (message.type === "awsProfiles") {
      panel.onAwsProfilesLoaded(message.profiles, message.currentProfile);
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
    const problem = await site.extractProblem();
    if (problem?.slug !== currentProblem?.slug) {
      history = [];
      lastHintCode = null;
      interviewHistory = [];
    }
    currentProblem = problem;
    // Write solve-history before notifying the panel — the Solved/Attempted
    // sidebar refetches storage as soon as it sees the new slug, so if the
    // write landed after that refetch the sidebar would show stale data.
    if (currentProblem) await recordProblemSeen(currentProblem, Date.now());
    panel.onProblemLoaded(currentProblem);
  }

  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === "requestHintShortcut") panel.triggerHintShortcut();
    if (message.type === "explainErrorShortcut") panel.triggerErrorShortcut();
  });

  loadProblem();
  site.onSlugChange(() => loadProblem());
  site.onAccepted(async () => {
    if (!currentProblem) {
      panel.onProblemAccepted();
      return;
    }
    const problem = currentProblem;
    const solution = await site.getCurrentCode().catch(() => null);
    // Same ordering concern as loadProblem: write before notifying, so the
    // sidebar's refetch (triggered by onProblemAccepted) sees the accepted
    // status instead of racing the storage write.
    await recordAccepted(problem, Date.now(), solution && solution.code ? { code: solution.code, language: solution.language } : undefined);
    panel.onProblemAccepted();
  });
  site.onError((error) => {
    lastSubmissionError = error;
    panel.onSubmissionError(error);
  });

  console.log(`[lctrainer] content script loaded on ${site.name} at`, location.pathname);
}

main();
