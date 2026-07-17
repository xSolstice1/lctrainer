import express from "express";
import cors from "cors";
import type { AppConfig } from "./config/env.js";
import type { ProviderRegistry } from "./providers/index.js";
import { createGuidanceRouter } from "./routes/guidance.js";
import { createHealthRouter } from "./routes/health.js";
import { createConfigRouter } from "./routes/config.js";
import { createJDAnalysisRouter } from "./routes/jdAnalysis.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(config: AppConfig, providers: ProviderRegistry) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        const isExtensionOrigin = origin.startsWith("chrome-extension://");
        if (
          config.devAllowAnyExtensionOrigin &&
          isExtensionOrigin
        ) {
          callback(null, true);
          return;
        }
        const id = origin.replace("chrome-extension://", "");
        if (isExtensionOrigin && config.allowedExtensionIds.includes(id)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(createHealthRouter());
  app.use(createConfigRouter(config, providers));
  app.use(createGuidanceRouter(config, providers));
  app.use(createJDAnalysisRouter(config, providers));

  app.use(errorHandler);

  return app;
}
