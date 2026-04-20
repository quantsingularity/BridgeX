import { Router, Response } from "express";
import { getBalances } from "../services/dataService";
import { listTokensForApp } from "../services/tokenService";
import type { AuthedRequest } from "../middleware/auth";
import { InstitutionId } from "../models/types";

export const balancesRouter = Router();

// GET /balances?institution_id=chase
balancesRouter.get(
  "/",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const appId = req.app_id!;
    const sandbox = req.sandbox!;
    const instId = req.query.institution_id as InstitutionId | undefined;

    try {
      if (instId) {
        const balances = await getBalances(appId, instId, sandbox);
        res.json({ balances, institution_id: instId, count: balances.length });
        return;
      }

      // All linked institutions
      const tokens = await listTokensForApp(appId);
      const active = tokens.filter((t: any) => t.status === "active");
      const all: any[] = [];
      for (const t of active) {
        const bals = await getBalances(
          appId,
          t.institution_id as InstitutionId,
          sandbox,
        );
        all.push(...bals);
      }
      res.json({ balances: all, count: all.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);
