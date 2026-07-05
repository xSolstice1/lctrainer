# lctrainer

A live LeetCode AI coding trainer: a Chrome extension reads your in-progress code and the current problem from a LeetCode problem page, and a local server streams back Socratic-style hints (never full solutions) from an LLM — a local model via Ollama, AWS Bedrock, or OpenRouter.

**Status: local-only personal tool, MVP.**

## Architecture

```
LeetCode page (content script + MAIN-world Monaco bridge)
        |  chrome.runtime.Port
        v
background service worker  --HTTP/SSE-->  local Express server  --> Ollama (local), AWS Bedrock (SSO), or OpenRouter
        |
        v
injected panel (shadow DOM)
```

## Packages

- `shared/` — TypeScript types shared between server and extension (`@lctrainer/shared`).
- `server/` — Express server that proxies LLM calls and streams responses over SSE.
- `extension/` — Manifest V3 Chrome extension (content script, background worker, injected panel, options page).

## Guidance philosophy

The system prompt instructs the model to give Socratic hints only — guiding questions, complexity/pattern nudges — and never full solutions or complete code. This is enforced via prompt engineering only; it is not a structural guarantee.

## Local dev setup

### 1. Install dependencies and build shared types

```
npm install
npm run build:shared
```

### 2. Configure and run the server

```
cp server/.env.example server/.env
```

Edit `server/.env`:
- `LLM_PROVIDER` picks the *default* provider used when the extension doesn't request one explicitly: `local` | `bedrock` | `openrouter`. It's optional — if unset, the server defaults to `bedrock` when `AWS_REGION` + `BEDROCK_MODEL_ID` are set, otherwise `local`.
- The extension can switch providers per-request at runtime (see step 4) regardless of the server's default, as long as that provider is configured.
- **Local (Ollama) — always available, no setup beyond installing Ollama and pulling a model:**
  1. Install [Ollama](https://ollama.com), then run `ollama pull qwen2.5-coder:7b`.
  2. Start it: `ollama serve` (usually already running as a background service after install).
  3. Optionally override `OLLAMA_BASE_URL` / `OLLAMA_MODEL_ID` in `.env` — defaults are `http://localhost:11434` and `qwen2.5-coder:7b`.
- **For Bedrock (AWS SSO, no static keys):**
  1. One-time: `aws configure sso` — creates a profile in `~/.aws/config`.
  2. Each session: `aws sso login --profile <profile>` (opens a browser to authenticate; caches a token for the session).
  3. Set `AWS_PROFILE=<profile>`, `AWS_REGION`, and `BEDROCK_MODEL_ID` in `.env`.
- **For OpenRouter:** set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL_ID`.

Then:

```
npm run dev:server
```

Smoke-test before touching the browser:

```
curl -N -X POST http://localhost:3001/api/guidance/stream \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"t1","problem":{"slug":"two-sum","title":"Two Sum","difficulty":"Easy","tags":[],"statementHtml":""},"code":{"language":"python","code":"","timestampMs":1}}'
```

### 3. Load the extension

```
npm run build:extension
```

Then in Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select `extension/dist`. Copy the generated extension ID; if not using `DEV_ALLOW_ANY_EXTENSION_ORIGIN=true`, add it to `ALLOWED_EXTENSION_IDS` in `server/.env`.

Open a `leetcode.com/problems/<slug>/` page — the panel should inject in the bottom-right. Click "Get a hint".

### 4. (Optional) Switch provider/model from the extension

Open the extension's options page (right-click the extension icon → Options, or `chrome://extensions` → Details → Extension options), or use the provider/model dropdowns directly in the injected panel. `GET /api/config` reports every provider the server has configured (`local` is always included); pick one to override the server's default per-request. Leave the provider on "Server default" to use whatever `LLM_PROVIDER` resolved to.

For Bedrock specifically, the options page also fetches the live list of Claude-on-Bedrock models available to your AWS account/region (via `GET /api/models/bedrock`) and lets you pick one, overriding `BEDROCK_MODEL_ID` per-request. Requires the SSO role to have `bedrock:ListFoundationModels` in addition to `bedrock:InvokeModelWithResponseStream`. If the model list fails to load (e.g. missing permission), you can still type a model ID manually. For `local`/`openrouter`, type a model ID manually or leave blank for the provider's default.

### Troubleshooting

- **Service worker logs**: `chrome://extensions` → click "service worker" under lctrainer.
- **AWS SSO session expired**: the server returns an error telling you to re-run `aws sso login --profile <profile>`.
- **CORS rejected**: check `ALLOWED_EXTENSION_IDS` matches the extension ID shown in `chrome://extensions`, or set `DEV_ALLOW_ANY_EXTENSION_ORIGIN=true` for local dev.
- **Content script not injecting**: confirm the URL matches `https://leetcode.com/problems/*`.
- **CRXJS dev mode**: `npm run dev:extension` hot-reloads the panel UI, but background/content script changes still require clicking "reload" on the extension in `chrome://extensions`.

## Known limitations (MVP scope)

- `window.monaco` global exposure and the `.view-lines` DOM fallback have not yet been verified against a live LeetCode page — this is the top risk area; if code capture looks wrong, check the browser console for `[lctrainer]` logs and inspect `extension/src/content/monacoBridge.ts`.
- No accounts, persistence, rate limiting, or production deployment — personal local tool only.
- Bedrock support is scoped to Anthropic Claude models only (messages API payload shape).
- Local provider quality depends entirely on the Ollama model chosen — small/quantized models (needed to fit weak hardware) will lag Claude/GPT-tier reasoning on Medium/Hard problems.
