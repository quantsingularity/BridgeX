import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db";
import { generateSecret } from "../utils/crypto";
import { recordAudit, listAudit } from "../services/auditService";

export const adminRouter = Router();

// GET /admin/stats - dashboard summary
adminRouter.get(
  "/stats",
  async (_req: Request, res: Response): Promise<void> => {
    const [counts] = await query<{
      total_apps: string;
      active_tokens: string;
      pending_webhooks: string;
      total_deliveries: string;
    }>(`
    SELECT
      (SELECT COUNT(*) FROM apps WHERE is_active=true)             AS total_apps,
      (SELECT COUNT(*) FROM institution_tokens WHERE status='active') AS active_tokens,
      (SELECT COUNT(*) FROM webhook_deliveries WHERE status IN ('pending','retrying')) AS pending_webhooks,
      (SELECT COUNT(*) FROM webhook_deliveries)                    AS total_deliveries
  `);

    const institutions = await query(`
    SELECT institution_id, COUNT(*) AS linked_count
    FROM institution_tokens WHERE status='active'
    GROUP BY institution_id ORDER BY linked_count DESC
  `);

    const recentDeliveries = await query(`
    SELECT event_type, status, attempts, delivered_at, created_at
    FROM webhook_deliveries ORDER BY created_at DESC LIMIT 20
  `);

    res.json({
      stats: counts,
      institutions_summary: institutions,
      recent_deliveries: recentDeliveries,
      generated_at: new Date().toISOString(),
    });
  },
);

// GET /admin/apps - list all apps
adminRouter.get(
  "/apps",
  async (_req: Request, res: Response): Promise<void> => {
    const apps = await query(`
    SELECT a.id, a.name, a.client_id, a.sandbox_mode, a.is_active,
           a.webhook_url, a.created_at,
           COUNT(DISTINCT it.id) AS linked_institutions,
           COUNT(DISTINCT wd.id) AS total_webhook_deliveries
    FROM apps a
    LEFT JOIN institution_tokens it ON it.app_id = a.id AND it.status = 'active'
    LEFT JOIN webhook_deliveries  wd ON wd.app_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `);
    res.json({ apps, count: apps.length });
  },
);

// POST /admin/apps - create a new app
adminRouter.post(
  "/apps",
  async (req: Request, res: Response): Promise<void> => {
    const { name, sandbox_mode = true } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const clientId = `bx_${uuidv4().replace(/-/g, "").slice(0, 16)}`;
    const clientSecret = generateSecret(24);

    const [app] = await query<{ id: string; name: string; client_id: string }>(
      `INSERT INTO apps (name, client_id, client_secret, sandbox_mode)
     VALUES ($1,$2,$3,$4) RETURNING id, name, client_id, sandbox_mode, created_at`,
      [name, clientId, clientSecret, sandbox_mode],
    );

    await recordAudit({
      appId: app.id,
      action: "app.created",
      resource: app.id,
      ipAddress: req.ip,
      details: { name, sandbox_mode },
    });

    res.status(201).json({
      ...app,
      client_secret: clientSecret,
      note: "Store client_secret securely - it will not be shown again.",
    });
  },
);

// GET /admin/audit - audit trail (most recent first)
adminRouter.get(
  "/audit",
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseInt((req.query.limit as string) || "100", 10);
    const appId = (req.query.app_id as string) || undefined;
    const entries = await listAudit({ appId, limit });
    res.json({ audit: entries, count: entries.length });
  },
);

// GET /admin/tokens - all institution tokens (no decrypted values)
adminRouter.get(
  "/tokens",
  async (_req: Request, res: Response): Promise<void> => {
    const tokens = await query(`
    SELECT it.id, it.app_id, a.name AS app_name, it.institution_id,
           it.institution_name, it.status, it.scopes,
           it.last_used_at, it.token_expires_at, it.created_at
    FROM institution_tokens it
    JOIN apps a ON a.id = it.app_id
    ORDER BY it.created_at DESC
    LIMIT 200
  `);
    res.json({ tokens, count: tokens.length });
  },
);

// GET /admin/webhooks - all webhook deliveries
adminRouter.get(
  "/webhooks",
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(
      parseInt((req.query.limit as string) || "100", 10),
      500,
    );
    const rows = await query(
      `
    SELECT wd.id, wd.app_id, a.name AS app_name, wd.event_type,
           wd.status, wd.attempts, wd.response_code,
           wd.delivered_at, wd.created_at
    FROM webhook_deliveries wd
    JOIN apps a ON a.id = wd.app_id
    ORDER BY wd.created_at DESC LIMIT $1
  `,
      [limit],
    );
    res.json({ deliveries: rows, count: rows.length });
  },
);
