import { loadConfig } from "./config/env.js";
import { createProviderRegistry } from "./providers/index.js";
import { createApp } from "./app.js";

const config = loadConfig();
const providers = createProviderRegistry(config);
const app = createApp(config, providers);

app.listen(config.port, () => {
  console.log(
    `lctrainer server listening on http://localhost:${config.port} (default provider: ${config.defaultProvider}, available: ${config.availableProviders.join(", ")})`
  );
});
