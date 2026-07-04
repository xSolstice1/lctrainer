import { loadConfig } from "./config/env.js";
import { getProvider } from "./providers/index.js";
import { createApp } from "./app.js";

const config = loadConfig();
const provider = getProvider(config);
const app = createApp(config, provider);

app.listen(config.port, () => {
  console.log(`lctrainer server listening on http://localhost:${config.port} (provider: ${config.llmProvider})`);
});
