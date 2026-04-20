import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";
import { config } from "../config";
import { logger } from "../utils/logger";
import type { AuthedRequest } from "./auth";

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: config.redis.url });
    redisClient.on("error", (err) =>
      logger.error("Redis error", { error: err.message }),
    );
    await redisClient.connect();
  }
  return redisClient;
}

export async function rateLimitMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const clientId = req.client_id || req.ip || "anon";
  const key = `bridgex:rl:${clientId}`;
  const windowMs = config.rateLimit.windowMs;
  const max = config.rateLimit.maxRequests;

  try {
    const redis = await getRedis();
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.pExpire(key, windowMs);
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - current));

    if (current > max) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Too many requests. Limit: ${max} per ${windowMs / 1000}s`,
        retryAfter: Math.ceil(windowMs / 1000),
      });
      return;
    }
    next();
  } catch {
    // Redis unavailable - fail open
    next();
  }
}
