/**
 * BridgeX Audit Service
 *
 * Writes structured audit entries to the audit_log table (previously defined
 * in the schema but never written to). Every privileged or state-changing
 * action records who did it, what resource was touched, the caller IP, and
 * arbitrary structured details.
 */
import { query } from "../db";
import { logger } from "../utils/logger";

export interface AuditEntry {
  appId?: string | null;
  action: string;
  resource?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (app_id, action, resource, ip_address, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.appId ?? null,
        entry.action,
        entry.resource ?? null,
        entry.ipAddress ?? null,
        JSON.stringify(entry.details ?? {}),
      ],
    );
  } catch (err) {
    // Auditing must never break the request path.
    logger.error("Failed to write audit entry", {
      action: entry.action,
      error: (err as Error).message,
    });
  }
}

export async function listAudit(
  options: { appId?: string; limit?: number } = {},
): Promise<unknown[]> {
  const limit = Math.min(options.limit ?? 100, 500);
  if (options.appId) {
    return query(
      `SELECT id, app_id, action, resource, ip_address, details, created_at
       FROM audit_log WHERE app_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [options.appId, limit],
    );
  }
  return query(
    `SELECT id, app_id, action, resource, ip_address, details, created_at
     FROM audit_log ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
}
