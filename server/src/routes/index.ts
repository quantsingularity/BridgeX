import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rateLimit";
import { institutionsRouter } from "./institutions";
import { linkRouter } from "./link";
import { accountsRouter } from "./accounts";
import { transactionsRouter } from "./transactions";
import { balancesRouter } from "./balances";
import { webhooksRouter } from "./webhooks";
import { appsRouter } from "./apps";
import { adminRouter } from "./admin";

const router = Router();

// Public routes
router.use("/institutions", institutionsRouter);
router.use("/link", linkRouter);

// Authenticated + rate-limited routes
const authed = Router();
authed.use(authenticate as any);
authed.use(rateLimitMiddleware as any);
authed.use("/accounts", accountsRouter);
authed.use("/transactions", transactionsRouter);
authed.use("/balances", balancesRouter);
authed.use("/webhooks", webhooksRouter);
authed.use("/apps", appsRouter);

router.use(authed);

// Admin routes (no auth in sandbox - add your own auth for production)
router.use("/admin", adminRouter);

export default router;
