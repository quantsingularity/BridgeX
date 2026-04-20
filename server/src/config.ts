import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  sandboxMode: process.env.SANDBOX_MODE !== "false",

  db: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://bridgex:bridgex_secret@localhost:5432/bridgex",
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379/0",
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || "change-me-exactly-32-chars-long!!",
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || "16", 10),
  },

  oauth: {
    callbackBaseUrl:
      process.env.OAUTH_CALLBACK_BASE_URL || "http://localhost:4000",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },

  webhook: {
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || "3", 10),
    retryBackoff: parseInt(process.env.WEBHOOK_RETRY_BACKOFF_MS || "5000", 10),
    timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || "10000", 10),
    secretLength: parseInt(process.env.WEBHOOK_SECRET_LENGTH || "32", 10),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || "http://localhost:3000")
      .split(",")
      .map((o) => o.trim()),
  },
} as const;
