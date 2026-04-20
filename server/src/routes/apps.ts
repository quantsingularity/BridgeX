import { Router, Response } from "express";
import { query } from "../db";
import { listTokensForApp, checkTokenHealth } from "../services/tokenService";
import type { AuthedRequest } from "../middleware/auth";

export const appsRouter = Router();

// GET /apps/me - current app info and linked institutions
appsRouter.get(
  "/me",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const appId = req.app_id!;
    const [app] = await query<{
      id: string;
      name: string;
      client_id: string;
      sandbox_mode: boolean;
      webhook_url: string | null;
      created_at: Date;
    }>(
      `SELECT id, name, client_id, sandbox_mode, webhook_url, created_at FROM apps WHERE id=$1`,
      [appId],
    );

    const tokens = await listTokensForApp(appId);
    const health = await checkTokenHealth(appId);

    res.json({ app, linked_institutions: tokens, token_health: health });
  },
);
