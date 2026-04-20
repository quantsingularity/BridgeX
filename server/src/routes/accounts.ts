import { Router, Response } from "express";
import { getAccounts } from "../services/dataService";
import { listTokensForApp } from "../services/tokenService";
import type { AuthedRequest } from "../middleware/auth";
import { InstitutionId } from "../models/types";

export const accountsRouter = Router();

// GET /accounts?institution_id=chase
accountsRouter.get(
  "/",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const appId = req.app_id!;
    const sandbox = req.sandbox!;
    const instId = req.query.institution_id as InstitutionId | undefined;

    try {
      if (instId) {
        const accounts = await getAccounts(appId, instId, sandbox);
        res.json({ accounts, institution_id: instId, count: accounts.length });
        return;
      }

      // Return accounts for all linked institutions
      const tokens = await listTokensForApp(appId);
      const active = tokens.filter((t: any) => t.status === "active");
      const all: any[] = [];

      for (const t of active) {
        const accs = await getAccounts(
          appId,
          t.institution_id as InstitutionId,
          sandbox,
        );
        all.push(...accs);
      }

      res.json({ accounts: all, count: all.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /accounts/:accountId
accountsRouter.get(
  "/:accountId",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const appId = req.app_id!;
    const sandbox = req.sandbox!;
    const instId = req.query.institution_id as InstitutionId;

    try {
      const accounts = await getAccounts(appId, instId, sandbox);
      const account = accounts.find((a) => a.id === req.params.accountId);
      if (!account) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);
