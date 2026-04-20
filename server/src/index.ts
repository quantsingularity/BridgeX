import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cron from "node-cron";

import { config } from "./config";
import { logger } from "./utils/logger";
import { checkDbConnection } from "./db";
import { deliverPendingWebhooks } from "./services/webhookService";
import routes from "./routes/index";

const app = express();

// Security + logging
app.use(helmet());
app.use(cors({ origin: config.cors.origins, credentials: true }));
app.use(
  morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/v1", routes);

// Health (no auth)
app.get("/health", async (_req, res) => {
  const dbOk = await checkDbConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    service: "bridgex",
    version: "0.1.0",
    sandbox: config.sandboxMode,
    timestamp: new Date().toISOString(),
  });
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error("Unhandled error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Internal server error" });
  },
);

// Webhook delivery cron - every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  try {
    await deliverPendingWebhooks();
  } catch (err: any) {
    logger.error("Webhook cron error", { error: err.message });
  }
});

app.listen(config.port, () => {
  logger.info(`BridgeX server started on :${config.port}`, {
    env: config.nodeEnv,
    sandbox: config.sandboxMode,
  });
});

export default app;
