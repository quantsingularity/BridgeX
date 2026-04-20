import { Router, Response } from "express";
import { query, queryOne } from "../db";
import { generateSecret } from "../utils/crypto";
import { getDeliveryLogs } from "../services/webhookService";
import type { AuthedRequest } from "../middleware/auth";

export const webhooksRouter = Router();

// POST /webhooks - register webhook for app
webhooksRouter.post(
  "/",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const appId = req.app_id!;
    const { url } = req.body;

    if (!url || !url.startsWith("http")) {
      res.status(400).json({ error: "A valid https URL is required" });
      return;
    }

    const secret = generateSecret(32);
    await query(
      `UPDATE apps SET webhook_url=$1, webhook_secret=$2, updated_at=NOW() WHERE id=$3`,
      [url, secret, appId],
    );

    res.status(201).json({
      webhook_url: url,
      webhook_secret: secret,
      message: "Store webhook_secret securely - it will not be shown again.",
      events: [
        "transactions.new",
        "balance.update",
        "account.update",
        "token.expired",
      ],
    });
  },
);

// GET /webhooks - current webhook config
webhooksRouter.get(
  "/",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const row = await queryOne<{ webhook_url: string | null }>(
      `SELECT webhook_url FROM apps WHERE id=$1`,
      [req.app_id!],
    );
    res.json({ webhook_url: row?.webhook_url ?? null });
  },
);

// DELETE /webhooks - remove webhook
webhooksRouter.delete(
  "/",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    await query(
      `UPDATE apps SET webhook_url=NULL, webhook_secret=NULL WHERE id=$1`,
      [req.app_id!],
    );
    res.status(204).end();
  },
);

// GET /webhooks/deliveries - delivery history
webhooksRouter.get(
  "/deliveries",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const logs = await getDeliveryLogs(req.app_id!, Math.min(limit, 200));
    res.json({ deliveries: logs, count: logs.length });
  },
);
