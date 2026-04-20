import { Router, Response } from "express";
import { getTransactions } from "../services/dataService";
import { listTokensForApp } from "../services/tokenService";
import type { AuthedRequest } from "../middleware/auth";
import { InstitutionId } from "../models/types";

export const transactionsRouter = Router();

// GET /transactions?institution_id=chase&start_date=2024-01-01&end_date=2024-01-31
// GET /transactions?account_id=xxx&count=50&offset=0
transactionsRouter.get(
  "/",
  async (req: AuthedRequest, res: Response): Promise<void> => {
    const appId = req.app_id!;
    const sandbox = req.sandbox!;
    const {
      institution_id,
      account_id,
      start_date,
      end_date,
      count = "100",
      offset = "0",
    } = req.query as Record<string, string>;

    try {
      if (institution_id) {
        const result = await getTransactions(
          appId,
          institution_id as InstitutionId,
          {
            startDate: start_date,
            endDate: end_date,
            accountId: account_id,
            count: parseInt(count, 10),
            offset: parseInt(offset, 10),
            sandbox,
          },
        );
        res.json({ ...result, institution_id });
        return;
      }

      // All linked institutions
      const tokens = await listTokensForApp(appId);
      const active = tokens.filter((t: any) => t.status === "active");
      const all: any[] = [];
      let total = 0;

      for (const t of active) {
        const r = await getTransactions(
          appId,
          t.institution_id as InstitutionId,
          {
            startDate: start_date,
            endDate: end_date,
            accountId: account_id,
            count: parseInt(count, 10),
            offset: parseInt(offset, 10),
            sandbox,
          },
        );
        all.push(...r.transactions);
        total += r.total;
      }

      // Sort combined by date desc
      all.sort((a, b) => b.date.localeCompare(a.date));
      res.json({ transactions: all, total, count: all.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);
