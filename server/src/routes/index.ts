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

// Admin routes must be registered BEFORE the authenticated catch-all below.
// The authed router is mounted at the root (router.use(authed)) and applies
// `authenticate` to every request that reaches it, so if /admin were declared
// after it, every admin call would be rejected with 401 before the admin
// router ran. (No auth in sandbox - add your own auth for production.)
router.use("/admin", adminRouter);

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

export default router;
