import type { ContentToBackgroundMessage, LLMProviderId, ModelInfo, ServerConfigInfo } from "@lctrainer/shared";
import { PORT_NAME } from "../lib/messaging.js";
import {
  DEFAULT_SERVER_URL,
  STORAGE_KEY_AWS_PROFILE,
  STORAGE_KEY_MODEL_ID,
  STORAGE_KEY_PROVIDER,
  STORAGE_KEY_SERVER_URL,
} from "../lib/constants.js";
import { parseSseStream } from "./sseClient.js";
import { describeFetchError, fetchWithTimeout } from "../lib/fetchWithTimeout.js";

async function getServerUrl(): Promise<string> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_SERVER_URL);
  return stored[STORAGE_KEY_SERVER_URL] ?? DEFAULT_SERVER_URL;
}

async function getProviderId(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_PROVIDER);
  return stored[STORAGE_KEY_PROVIDER] || undefined;
}

async function getModelId(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_MODEL_ID);
  return stored[STORAGE_KEY_MODEL_ID] || undefined;
}

async function getAwsProfile(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_AWS_PROFILE);
  return stored[STORAGE_KEY_AWS_PROFILE] || undefined;
}

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === "request-hint") chrome.tabs.sendMessage(tab.id, { type: "requestHintShortcut" });
  if (command === "explain-error") chrome.tabs.sendMessage(tab.id, { type: "explainErrorShortcut" });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  const portAbort = new AbortController();
  port.onDisconnect.addListener(() => portAbort.abort());

  // Only one guidance request should stream at a time per port; a new
  // request supersedes whatever is currently in flight.
  let activeRequestId: string | null = null;
  let activeRequestAbort: AbortController | null = null;
  let cancelledRequestId: string | null = null;

  port.onMessage.addListener(async (message: ContentToBackgroundMessage) => {
    if (message.type === "ping") {
      port.postMessage({ type: "pong" });
      return;
    }

    if (message.type === "cancelGuidance") {
      if (activeRequestId === message.requestId) {
        cancelledRequestId = message.requestId;
        activeRequestAbort?.abort();
      }
      return;
    }

    const serverUrl = await getServerUrl();

    if (message.type === "requestServerInfo") {
      try {
        const configRes = await fetchWithTimeout(`${serverUrl}/api/config`);
        if (!configRes.ok) throw new Error(`${configRes.status} ${configRes.statusText}`);
        const config: ServerConfigInfo = await configRes.json();

        const modelsByProvider: Partial<Record<LLMProviderId, ModelInfo[]>> = {};
        await Promise.all(
          config.providers
            .filter((p) => p.supportsModelList)
            .map(async (p) => {
              const modelsRes = await fetchWithTimeout(`${serverUrl}/api/models/${p.id}`);
              if (modelsRes.ok) {
                const data: { models: ModelInfo[] } = await modelsRes.json();
                modelsByProvider[p.id] = data.models;
              }
            })
        );

        port.postMessage({ type: "serverInfo", config, modelsByProvider });
      } catch (err) {
        port.postMessage({ type: "serverInfoError", message: describeFetchError(err) });
      }
      return;
    }

    if (message.type === "requestAwsProfiles") {
      try {
        const res = await fetchWithTimeout(`${serverUrl}/api/aws-profiles`);
        if (res.ok) {
          const data: { profiles: string[]; currentProfile: string | null } = await res.json();
          port.postMessage({ type: "awsProfiles", profiles: data.profiles, currentProfile: data.currentProfile });
        }
      } catch {
        // silently ignore — aws profiles are optional
      }
      return;
    }

    if (message.type === "requestJDAnalysis") {
      const { requestId, jdText, provider, modelId, awsProfile, lcQuestionCount, interviewQuestionCount } = message;
      try {
        const body: Record<string, string | number> = { jdText };
        if (provider) body.provider = provider;
        if (modelId) body.modelId = modelId;
        if (awsProfile) body.awsProfile = awsProfile;
        if (lcQuestionCount) body.lcQuestionCount = lcQuestionCount;
        if (interviewQuestionCount) body.interviewQuestionCount = interviewQuestionCount;
        const res = await fetch(`${serverUrl}/api/jd/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          port.postMessage({ type: "jdAnalysisError", requestId, message: err.error ?? `Server error ${res.status}` });
        } else {
          const result = await res.json();
          port.postMessage({ type: "jdAnalysisResult", requestId, result });
        }
      } catch (err: any) {
        port.postMessage({ type: "jdAnalysisError", requestId, message: err?.message ?? "JD analysis failed" });
      }
      return;
    }

    if (message.type !== "requestGuidance") return;

    const { requestId } = message.request;
    activeRequestAbort?.abort();
    const requestAbort = new AbortController();
    activeRequestId = requestId;
    activeRequestAbort = requestAbort;
    portAbort.signal.addEventListener("abort", () => requestAbort.abort());

    const providerId = await getProviderId();
    const modelId = await getModelId();
    const awsProfile = await getAwsProfile();

    let response: Response;
    try {
      response = await fetch(`${serverUrl}/api/guidance/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...message.request,
          provider: message.request.provider ?? providerId,
          modelId: message.request.modelId ?? modelId,
          awsProfile: awsProfile || undefined,
        }),
        signal: requestAbort.signal,
      });
    } catch (err: any) {
      if (cancelledRequestId === requestId) {
        port.postMessage({ type: "guidanceCancelled", requestId });
      } else if (activeRequestId === requestId) {
        port.postMessage({ type: "connectionError", requestId, message: err?.message ?? "Failed to reach server" });
      }
      return;
    }

    if (!response.ok || !response.body) {
      if (activeRequestId === requestId) {
        port.postMessage({
          type: "connectionError",
          requestId,
          message: `Server error: ${response.status} ${response.statusText}`,
        });
      }
      return;
    }

    try {
      for await (const chunk of parseSseStream(response.body)) {
        if (activeRequestId !== requestId) break; // superseded by a newer request
        port.postMessage({ type: "guidanceChunk", requestId, chunk });
        if (chunk.type === "done" || chunk.type === "error") break;
      }
    } catch (err: any) {
      if (cancelledRequestId === requestId) {
        port.postMessage({ type: "guidanceCancelled", requestId });
      } else if (activeRequestId === requestId) {
        port.postMessage({
          type: "connectionError",
          requestId,
          message: err?.message ?? "Connection to server was lost",
        });
      }
    }
  });
});
