/**
 * BridgeX Authentication Middleware
 * Validates client_id + client_secret via Basic Auth or Authorization header.
 */
import { Request, Response, NextFunction } from "express";
import { queryOne } from "../db";
import { logger } from "../utils/logger";

export interface AuthedRequest extends Request {
  app_id?: string;
  client_id?: string;
  sandbox?: boolean;
}

interface AppRow {
  id: string;
  client_id: string;
  sandbox_mode: boolean;
  is_active: boolean;
}

export async function authenticate(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let clientId: string | null = null;
    let clientSecret: string | null = null;

    // Support Basic Auth header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Basic ")) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString(
        "utf8",
      );
      const [id, secret] = decoded.split(":");
      clientId = id;
      clientSecret = secret;
    }

    // Support x-client-id + x-client-secret headers
    if (!clientId) {
      clientId = req.headers["x-client-id"] as string;
      clientSecret = req.headers["x-client-secret"] as string;
    }

    if (!clientId || !clientSecret) {
      res.status(401).json({ error: "Missing credentials" });
      return;
    }

    const app = await queryOne<AppRow>(
      `SELECT id, client_id, sandbox_mode, is_active
       FROM apps WHERE client_id = $1 AND client_secret = $2`,
      [clientId, clientSecret],
    );

    if (!app || !app.is_active) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.app_id = app.id;
    req.client_id = app.client_id;
    req.sandbox = app.sandbox_mode;
    next();
  } catch (err) {
    logger.error("Auth middleware error", { error: (err as Error).message });
    res.status(500).json({ error: "Authentication error" });
  }
}
