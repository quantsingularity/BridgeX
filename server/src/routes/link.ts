/**
 * BridgeX Institution Linking (OAuth 2.0)
 *
 * Flow:
 *   1. App calls POST /link/create    => gets a link_url
 *   2. User visits link_url in browser, selects institution, authorises
 *   3. Institution redirects to GET /link/callback?code=...&state=...
 *   4. BridgeX exchanges code for token, stores encrypted, notifies app
 *
 * In sandbox mode, step 3 is simulated automatically.
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { query, queryOne } from "../db";
import { storeToken } from "../services/tokenService";
import { queueWebhookEvent } from "../services/webhookService";
import { recordAudit } from "../services/auditService";
import { getInstitution } from "../adapters/institutions";
import { config } from "../config";
import { logger } from "../utils/logger";
import { InstitutionId } from "../models/types";

export const linkRouter = Router();

// All routes in this app are mounted under /v1 (see routes/index.ts).
// Generated OAuth URLs must include that prefix or the browser flow 404s.
const API_PREFIX = "/v1";

// POST /link/create - initiate a link session
linkRouter.post(
  "/create",
  async (req: Request, res: Response): Promise<void> => {
    const { client_id, client_secret, institution_id, redirect_uri } = req.body;

    if (!client_id || !client_secret) {
      res
        .status(400)
        .json({ error: "client_id and client_secret are required" });
      return;
    }
    if (!institution_id) {
      res.status(400).json({ error: "institution_id is required" });
      return;
    }

    const inst = getInstitution(institution_id as InstitutionId);
    if (!inst) {
      res.status(400).json({ error: `Unknown institution: ${institution_id}` });
      return;
    }

    // Verify app credentials
    const app = await queryOne<{ id: string; sandbox_mode: boolean }>(
      `SELECT id, sandbox_mode FROM apps WHERE client_id=$1 AND client_secret=$2 AND is_active=true`,
      [client_id, client_secret],
    );
    if (!app) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const state = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await query(
      `INSERT INTO link_sessions (app_id, institution_id, state, status, expires_at)
     VALUES ($1,$2,$3,'pending',$4)`,
      [app.id, institution_id, state, expiresAt],
    );

    const linkUrl = `${config.oauth.callbackBaseUrl}${API_PREFIX}/link/authorize?state=${state}&institution_id=${institution_id}`;

    // Sandbox: auto-complete the link immediately (simulate OAuth in background)
    if (app.sandbox_mode) {
      setImmediate(() =>
        simulateSandboxOAuth(app.id, institution_id as InstitutionId, state),
      );
    }

    res.status(201).json({
      link_url: linkUrl,
      state,
      expires_at: expiresAt.toISOString(),
      institution: inst,
      sandbox: app.sandbox_mode,
      message: app.sandbox_mode
        ? "Sandbox mode: link will complete automatically within 1 second."
        : "Direct user to link_url to complete OAuth authorization.",
    });
  },
);

// GET /link/authorize - browser landing page for OAuth (redirects to institution)
linkRouter.get(
  "/authorize",
  async (req: Request, res: Response): Promise<void> => {
    const { state, institution_id } = req.query as {
      state: string;
      institution_id: string;
    };

    const session = await queryOne<{ app_id: string; status: string }>(
      `SELECT app_id, status FROM link_sessions WHERE state=$1 AND expires_at > NOW()`,
      [state],
    );
    if (!session) {
      res.status(400).send("<h2>Invalid or expired link session</h2>");
      return;
    }
    if (session.status !== "pending") {
      res.status(400).send("<h2>Link session already used</h2>");
      return;
    }

    const inst = getInstitution(institution_id as InstitutionId);

    // In sandbox mode, auto-redirect to callback with a fake code
    const callbackUrl =
      `${config.oauth.callbackBaseUrl}${API_PREFIX}/link/callback` +
      `?code=sandbox_code_${uuidv4().replace(/-/g, "")}&state=${state}`;

    // Simple HTML landing page
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect to ${inst?.name ?? institution_id}</title>
      <style>
        body { font-family: -apple-system, sans-serif; display:flex; align-items:center;
               justify-content:center; min-height:100vh; background:#0f1117; color:#e2e8f0; }
        .card { background:#1a1f2e; border:1px solid #2a3248; border-radius:12px;
                padding:32px; max-width:400px; text-align:center; }
        h2 { margin:0 0 8px; color:#f1f5f9; }
        p  { color:#64748b; font-size:14px; }
        .btn { display:inline-block; margin-top:20px; padding:12px 24px;
               background:#6366f1; color:#fff; border-radius:8px; text-decoration:none;
               font-weight:600; font-size:14px; }
      </style>
      <meta http-equiv="refresh" content="1;url=${callbackUrl}">
    </head>
    <body>
      <div class="card">
        <h2>Connecting to ${inst?.name ?? institution_id}</h2>
        <p>Sandbox mode - authorizing automatically...</p>
        <a href="${callbackUrl}" class="btn">Continue</a>
      </div>
    </body>
    </html>
  `);
  },
);

// GET /link/callback - OAuth callback handler
linkRouter.get(
  "/callback",
  async (req: Request, res: Response): Promise<void> => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      await query(`UPDATE link_sessions SET status='failed' WHERE state=$1`, [
        state,
      ]);
      res.send("<h2>Authorization denied by user.</h2>");
      return;
    }

    const session = await queryOne<{
      app_id: string;
      institution_id: string;
      status: string;
    }>(
      `SELECT app_id, institution_id, status FROM link_sessions
     WHERE state=$1 AND expires_at > NOW()`,
      [state],
    );
    if (!session || session.status !== "pending") {
      res.status(400).send("<h2>Invalid or expired link session</h2>");
      return;
    }

    const institutionId = session.institution_id as InstitutionId;
    const inst = getInstitution(institutionId);

    // Exchange code for tokens (sandbox: use fake tokens)
    const accessToken = `access_${institutionId}_${uuidv4().replace(/-/g, "")}`;
    const refreshToken = `refresh_${institutionId}_${uuidv4().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    await storeToken({
      appId: session.app_id,
      institutionId,
      institutionName: inst?.name ?? institutionId,
      accessToken,
      refreshToken,
      expiresAt,
      scopes: ["accounts", "transactions", "balances"],
    });

    await query(`UPDATE link_sessions SET status='completed' WHERE state=$1`, [
      state,
    ]);

    // Notify app via webhook
    await queueWebhookEvent(session.app_id, {
      eventType: "account.update",
      institutionId,
      appId: session.app_id,
      timestamp: new Date().toISOString(),
      data: { linked: true, institution: inst?.name },
    });

    logger.info("Institution linked", {
      appId: session.app_id,
      institution: institutionId,
    });

    await recordAudit({
      appId: session.app_id,
      action: "institution.linked",
      resource: institutionId,
      ipAddress: req.ip,
      details: { institution: inst?.name, sandbox: false },
    });

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connected!</title>
      <style>
        body { font-family:-apple-system,sans-serif; display:flex; align-items:center;
               justify-content:center; min-height:100vh; background:#0f1117; color:#e2e8f0; }
        .card { background:#1a1f2e; border:1px solid #10b981; border-radius:12px;
                padding:32px; max-width:400px; text-align:center; }
        h2 { color:#34d399; } p { color:#64748b; font-size:14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Connected to ${inst?.name ?? institutionId}!</h2>
        <p>You can now close this window. Your app will receive the connection event.</p>
      </div>
    </body>
    </html>
  `);
  },
);

// POST /link/status - check link session status
linkRouter.post(
  "/status",
  async (req: Request, res: Response): Promise<void> => {
    const { state } = req.body;
    const session = await queryOne<{ status: string; institution_id: string }>(
      `SELECT status, institution_id FROM link_sessions WHERE state=$1`,
      [state],
    );
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({
      state,
      status: session.status,
      institution_id: session.institution_id,
    });
  },
);

// DELETE /link/:institutionId - revoke institution link
linkRouter.delete(
  "/:institutionId",
  async (req: Request, res: Response): Promise<void> => {
    const { client_id, client_secret } = req.body;
    const app = await queryOne<{ id: string }>(
      `SELECT id FROM apps WHERE client_id=$1 AND client_secret=$2`,
      [client_id, client_secret],
    );
    if (!app) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const { revokeToken } = await import("../services/tokenService");
    const ok = await revokeToken(
      app.id,
      req.params.institutionId as InstitutionId,
    );
    if (ok) {
      await recordAudit({
        appId: app.id,
        action: "institution.revoked",
        resource: req.params.institutionId,
        ipAddress: req.ip,
        details: {},
      });
    }
    res
      .status(ok ? 200 : 404)
      .json({ ok, institution_id: req.params.institutionId });
  },
);

async function simulateSandboxOAuth(
  appId: string,
  institutionId: InstitutionId,
  state: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 800));
  const inst = getInstitution(institutionId);
  const accessToken = `sandbox_access_${institutionId}_${uuidv4().replace(/-/g, "")}`;
  const refreshToken = `sandbox_refresh_${institutionId}_${uuidv4().replace(/-/g, "")}`;
  await storeToken({
    appId,
    institutionId,
    institutionName: inst?.name ?? institutionId,
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    scopes: ["accounts", "transactions", "balances"],
  });
  await query(`UPDATE link_sessions SET status='completed' WHERE state=$1`, [
    state,
  ]);
  await queueWebhookEvent(appId, {
    eventType: "account.update",
    institutionId,
    appId,
    timestamp: new Date().toISOString(),
    data: { linked: true, sandbox: true, institution: inst?.name },
  });
  logger.info("Sandbox OAuth simulated", { appId, institutionId });
  await recordAudit({
    appId,
    action: "institution.linked",
    resource: institutionId,
    details: { institution: inst?.name, sandbox: true },
  });
}
