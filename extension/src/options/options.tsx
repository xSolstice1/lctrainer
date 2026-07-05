import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BedrockModelInfo, ServerConfigInfo } from "@lctrainer/shared";
import {
  DEFAULT_SERVER_URL,
  STORAGE_KEY_MODEL_ID,
  STORAGE_KEY_PROVIDER,
  STORAGE_KEY_SERVER_URL,
} from "../lib/constants.js";

type ConnectionStatus = { state: "idle" } | { state: "testing" } | { state: "ok" } | { state: "error"; message: string };
type ModelsStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "loaded"; models: BedrockModelInfo[] }
  | { state: "error"; message: string };

function OptionsApp() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "idle" });
  const [serverConfig, setServerConfig] = useState<ServerConfigInfo | null>(null);
  const [models, setModels] = useState<ModelsStatus>({ state: "idle" });

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY_SERVER_URL, STORAGE_KEY_PROVIDER, STORAGE_KEY_MODEL_ID]).then((stored) => {
      if (stored[STORAGE_KEY_SERVER_URL]) setServerUrl(stored[STORAGE_KEY_SERVER_URL]);
      if (stored[STORAGE_KEY_PROVIDER]) setProviderId(stored[STORAGE_KEY_PROVIDER]);
      if (stored[STORAGE_KEY_MODEL_ID]) setModelId(stored[STORAGE_KEY_MODEL_ID]);
    });
  }, []);

  const loadServerConfigAndModels = async (url: string, forProviderId: string) => {
    try {
      const configRes = await fetch(`${url}/api/config`);
      if (!configRes.ok) throw new Error(`${configRes.status} ${configRes.statusText}`);
      const config: ServerConfigInfo = await configRes.json();
      setServerConfig(config);

      const effectiveProviderId = forProviderId || config.defaultProvider;
      if (effectiveProviderId !== "bedrock") {
        setModels({ state: "idle" });
        return;
      }

      setModels({ state: "loading" });
      const modelsRes = await fetch(`${url}/api/models/bedrock`);
      if (!modelsRes.ok) throw new Error(`${modelsRes.status} ${modelsRes.statusText}`);
      const data: { models: BedrockModelInfo[] } = await modelsRes.json();
      setModels({ state: "loaded", models: data.models });
    } catch (err: any) {
      setModels({ state: "error", message: err?.message ?? "Failed to load models" });
    }
  };

  useEffect(() => {
    loadServerConfigAndModels(serverUrl, providerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProviderChange = (newProviderId: string) => {
    setProviderId(newProviderId);
    setModelId("");
    loadServerConfigAndModels(serverUrl, newProviderId);
  };

  const handleSave = async () => {
    await chrome.storage.local.set({
      [STORAGE_KEY_SERVER_URL]: serverUrl,
      [STORAGE_KEY_PROVIDER]: providerId,
      [STORAGE_KEY_MODEL_ID]: modelId,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleTestConnection = async () => {
    setStatus({ state: "testing" });
    try {
      const res = await fetch(`${serverUrl}/health`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setStatus({ state: "ok" });
      await loadServerConfigAndModels(serverUrl, providerId);
    } catch (err: any) {
      setStatus({ state: "error", message: err?.message ?? "Connection failed" });
    }
  };

  const effectiveProviderId = providerId || serverConfig?.defaultProvider || "";
  const selectedProviderInfo = serverConfig?.providers.find((p) => p.id === effectiveProviderId);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 480, padding: 24 }}>
      <h2>lctrainer settings</h2>
      <label>
        Server URL
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
        />
      </label>

      <div style={{ marginTop: 16 }}>
        <label>
          Provider
          <select
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
          >
            <option value="">Server default ({serverConfig?.defaultProvider ?? "..."})</option>
            {(serverConfig?.providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>
          Model
          {models.state === "loaded" ? (
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
            >
              <option value="">Server default ({selectedProviderInfo?.defaultModelId})</option>
              {models.models.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.modelName} — {m.modelId}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder={
                models.state === "loading"
                  ? "Loading models from server..."
                  : "Leave blank for provider default, or type a model ID"
              }
              style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
            />
          )}
        </label>
        {models.state === "error" && (
          <p style={{ color: "red", fontSize: 12 }}>
            Could not load Bedrock model list: {models.message}. You can still type a model ID manually.
          </p>
        )}
        {effectiveProviderId && effectiveProviderId !== "bedrock" && (
          <p style={{ fontSize: 12, color: "#666" }}>
            Model list picker only applies to the Bedrock provider — for {effectiveProviderId}, type a model ID manually or leave blank for the server default.
          </p>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleTestConnection} disabled={status.state === "testing"}>
          {status.state === "testing" ? "Testing..." : "Test connection"}
        </button>
      </div>
      {saved && <p>Saved.</p>}
      {status.state === "ok" && <p style={{ color: "green" }}>Connected successfully.</p>}
      {status.state === "error" && <p style={{ color: "red" }}>Connection failed: {status.message}</p>}
    </div>
  );
}

const root = document.getElementById("root")!;
createRoot(root).render(<OptionsApp />);
