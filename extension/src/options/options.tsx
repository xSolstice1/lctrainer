import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ModelInfo, ServerConfigInfo } from "@lctrainer/shared";
import {
  DEFAULT_SERVER_URL,
  STORAGE_KEY_MODEL_ID,
  STORAGE_KEY_PROVIDER,
  STORAGE_KEY_SERVER_URL,
} from "../lib/constants.js";
import { describeFetchError, fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { useTheme } from "../lib/useTheme.js";
import { getSolveHistory, type ProblemRecord } from "../lib/solveHistory.js";
import { computeDayStreak, computeWeakTags } from "../lib/learnedGroups.js";
import "./options.css";

type ConnectionStatus = { state: "idle" } | { state: "testing" } | { state: "ok" } | { state: "error"; message: string };
type ModelsStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "loaded"; models: ModelInfo[] }
  | { state: "error"; message: string };

function StatsSection() {
  const [records, setRecords] = useState<ProblemRecord[] | null>(null);

  useEffect(() => {
    getSolveHistory().then((history) => setRecords(Object.values(history)));
  }, []);

  if (!records) return null;

  const solved = records.filter((r) => r.acceptedMs !== null);
  const totalHints = records.reduce((sum, r) => sum + r.hintCount, 0);
  const streak = computeDayStreak(records);
  const weakTags = computeWeakTags(records);

  return (
    <div className="options-stats">
      <h3>Your stats</h3>
      {records.length === 0 ? (
        <p className="hint">No problems tracked yet — solve one on LeetCode to see stats here.</p>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-tile">
              <span className="stat-value">{solved.length}</span>
              <span className="stat-label">Solved</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{streak}</span>
              <span className="stat-label">Day streak</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{totalHints}</span>
              <span className="stat-label">Hints used</span>
            </div>
          </div>
          {weakTags.length > 0 && (
            <div className="weak-tags">
              <p className="hint">Tags where you lean on hints most:</p>
              <ul>
                {weakTags.map((t) => (
                  <li key={t.tag}>
                    {t.tag} — avg {t.avgHints.toFixed(1)} hints/problem ({t.count} solved)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OptionsApp() {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);
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
      const configRes = await fetchWithTimeout(`${url}/api/config`);
      if (!configRes.ok) throw new Error(`${configRes.status} ${configRes.statusText}`);
      const config: ServerConfigInfo = await configRes.json();
      setServerConfig(config);

      const effectiveProviderId = forProviderId || config.defaultProvider;
      const providerInfo = config.providers.find((p) => p.id === effectiveProviderId);
      if (!providerInfo?.supportsModelList) {
        setModels({ state: "idle" });
        return;
      }

      setModels({ state: "loading" });
      const modelsRes = await fetchWithTimeout(`${url}/api/models/${effectiveProviderId}`);
      if (!modelsRes.ok) throw new Error(`${modelsRes.status} ${modelsRes.statusText}`);
      const data: { models: ModelInfo[] } = await modelsRes.json();
      setModels({ state: "loaded", models: data.models });
    } catch (err) {
      setModels({ state: "error", message: describeFetchError(err) });
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
      const res = await fetchWithTimeout(`${serverUrl}/health`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setStatus({ state: "ok" });
      await loadServerConfigAndModels(serverUrl, providerId);
    } catch (err) {
      setStatus({ state: "error", message: describeFetchError(err) });
    }
  };

  const effectiveProviderId = providerId || serverConfig?.defaultProvider || "";
  const selectedProviderInfo = serverConfig?.providers.find((p) => p.id === effectiveProviderId);

  return (
    <div className="options-page">
      <div className="options-header">
        <h2>Leetcode Trainer settings</h2>
        <button
          type="button"
          className="icon-button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
      </div>

      <label>
        Server URL
        <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
      </label>

      <div style={{ marginTop: 16 }}>
        <label>
          Provider
          <select value={providerId} onChange={(e) => handleProviderChange(e.target.value)}>
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
            <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">Server default ({selectedProviderInfo?.defaultModelId})</option>
              {models.models.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.modelName === m.modelId ? m.modelId : `${m.modelName} — ${m.modelId}`}
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
            />
          )}
        </label>
        {models.state === "error" && (
          <p className="error">
            Could not load model list for {effectiveProviderId}: {models.message}. You can still type a model ID
            manually.
          </p>
        )}
        {selectedProviderInfo && !selectedProviderInfo.supportsModelList && (
          <p className="hint">
            Model list picker isn't available for {effectiveProviderId} — type a model ID manually or leave blank
            for the server default.
          </p>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleTestConnection} disabled={status.state === "testing"}>
          {status.state === "testing" ? "Testing..." : "Test connection"}
        </button>
      </div>
      {saved && <p className="success">Saved.</p>}
      {status.state === "ok" && <p className="success">Connected successfully.</p>}
      {status.state === "error" && <p className="error">Connection failed: {status.message}</p>}

      <StatsSection />

      <div className="options-footer">Made by Vectr Labs</div>
    </div>
  );
}

const root = document.getElementById("root")!;
createRoot(root).render(<OptionsApp />);
