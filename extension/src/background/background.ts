import type { BedrockModelInfo, ContentToBackgroundMessage, ServerConfigInfo } from "@lctrainer/shared";
import { PORT_NAME } from "../lib/messaging.js";
import {
  DEFAULT_SERVER_URL,
  STORAGE_KEY_MODEL_ID,
  STORAGE_KEY_PROVIDER,
  STORAGE_KEY_SERVER_URL,
} from "../lib/constants.js";
import { parseSseStream } from "./sseClient.js";

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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  const abortController = new AbortController();
  port.onDisconnect.addListener(() => abortController.abort());

  port.onMessage.addListener(async (message: ContentToBackgroundMessage) => {
    if (message.type === "ping") {
      port.postMessage({ type: "pong" });
      return;
    }

    const serverUrl = await getServerUrl();

    if (message.type === "requestServerInfo") {
      try {
        const configRes = await fetch(`${serverUrl}/api/config`);
        if (!configRes.ok) throw new Error(`${configRes.status} ${configRes.statusText}`);
        const config: ServerConfigInfo = await configRes.json();

        let models: BedrockModelInfo[] = [];
        if (config.providers.some((p) => p.id === "bedrock")) {
          const modelsRes = await fetch(`${serverUrl}/api/models/bedrock`);
          if (modelsRes.ok) {
            const data: { models: BedrockModelInfo[] } = await modelsRes.json();
            models = data.models;
          }
        }

        port.postMessage({ type: "serverInfo", config, models });
      } catch (err: any) {
        port.postMessage({ type: "serverInfoError", message: err?.message ?? "Failed to reach server" });
      }
      return;
    }

    if (message.type !== "requestGuidance") return;

    const providerId = await getProviderId();
    const modelId = await getModelId();

    let response: Response;
    try {
      response = await fetch(`${serverUrl}/api/guidance/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...message.request,
          provider: message.request.provider ?? providerId,
          modelId: message.request.modelId ?? modelId,
        }),
        signal: abortController.signal,
      });
    } catch (err: any) {
      port.postMessage({ type: "connectionError", message: err?.message ?? "Failed to reach server" });
      return;
    }

    if (!response.ok || !response.body) {
      port.postMessage({ type: "connectionError", message: `Server error: ${response.status} ${response.statusText}` });
      return;
    }

    for await (const chunk of parseSseStream(response.body)) {
      port.postMessage({ type: "guidanceChunk", chunk });
      if (chunk.type === "done" || chunk.type === "error") break;
    }
  });
});
