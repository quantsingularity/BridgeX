import { query, queryOne } from "../db";
import { encrypt, decrypt } from "../utils/crypto";
import { TokenRecord, InstitutionId } from "../models/types";
import { queueWebhookEvent } from "./webhookService";
import { logger } from "../utils/logger";

export async function storeToken(params: {
  appId: string;
  institutionId: InstitutionId;
  institutionName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
}): Promise<TokenRecord> {
  const encAccess = encrypt(params.accessToken);
  const encRefresh = params.refreshToken ? encrypt(params.refreshToken) : null;

  const [row] = await query<TokenRecord>(
    `
    INSERT INTO institution_tokens
      (app_id, institution_id, institution_name,
       encrypted_access_token, encrypted_refresh_token,
       token_expires_at, scopes, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'active')
    ON CONFLICT (app_id, institution_id) DO UPDATE
      SET encrypted_access_token  = EXCLUDED.encrypted_access_token,
          encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
          token_expires_at        = EXCLUDED.token_expires_at,
          scopes                  = EXCLUDED.scopes,
          status                  = 'active',
          last_refreshed_at       = NOW(),
          updated_at              = NOW()
    RETURNING *
  `,
    [
      params.appId,
      params.institutionId,
      params.institutionName,
      encAccess,
      encRefresh,
      params.expiresAt ?? null,
      params.scopes ?? [],
    ],
  );

  logger.info("Token stored", {
    appId: params.appId,
    institution: params.institutionId,
  });
  return row;
}

export async function getDecryptedToken(
  appId: string,
  institutionId: InstitutionId,
): Promise<{ accessToken: string; refreshToken: string | null } | null> {
  const row = await queryOne<{
    id: string;
    encrypted_access_token: string;
    encrypted_refresh_token: string | null;
  }>(
    `
    SELECT id, encrypted_access_token, encrypted_refresh_token
    FROM institution_tokens
    WHERE app_id = $1 AND institution_id = $2 AND status = 'active'
  `,
    [appId, institutionId],
  );

  if (!row) return null;

  // Update last_used_at
  await query(
    `UPDATE institution_tokens SET last_used_at = NOW() WHERE id = $1`,
    [row.id],
  );

  return {
    accessToken: decrypt(row.encrypted_access_token),
    refreshToken: row.encrypted_refresh_token
      ? decrypt(row.encrypted_refresh_token)
      : null,
  };
}

export interface TokenSummary {
  id: string;
  app_id: string;
  institution_id: InstitutionId;
  institution_name: string;
  token_expires_at: Date | null;
  scopes: string[];
  status: TokenRecord["status"];
  last_used_at: Date | null;
  last_refreshed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function listTokensForApp(appId: string): Promise<TokenSummary[]> {
  return query<TokenSummary>(
    `
    SELECT id, app_id, institution_id, institution_name,
           token_expires_at, scopes, status,
           last_used_at, last_refreshed_at, created_at, updated_at
    FROM institution_tokens
    WHERE app_id = $1
    ORDER BY created_at DESC
  `,
    [appId],
  );
}

export async function revokeToken(
  appId: string,
  institutionId: InstitutionId,
): Promise<boolean> {
  const result = await query(
    `UPDATE institution_tokens SET status = 'revoked', updated_at = NOW()
     WHERE app_id = $1 AND institution_id = $2 AND status = 'active'
     RETURNING id`,
    [appId, institutionId],
  );
  if (result.length > 0) {
    logger.info("Token revoked", { appId, institutionId });
    return true;
  }
  return false;
}

export async function checkTokenHealth(appId: string): Promise<
  {
    institution: string;
    status: string;
    expiresAt: Date | null;
    lastUsed: Date | null;
  }[]
> {
  return query(
    `
    SELECT institution_id AS institution, status,
           token_expires_at AS "expiresAt", last_used_at AS "lastUsed"
    FROM institution_tokens
    WHERE app_id = $1
    ORDER BY institution_id
  `,
    [appId],
  );
}

/**
 * Sweep tokens whose expiry has passed: flip them from 'active' to 'expired'
 * and emit a `token.expired` webhook so connected apps can re-link. This is run
 * on a cron and exercises the token.expired event type that was previously
 * declared but never emitted.
 */
export async function sweepExpiredTokens(): Promise<number> {
  const expired = await query<{
    id: string;
    app_id: string;
    institution_id: InstitutionId;
    institution_name: string;
  }>(
    `UPDATE institution_tokens
     SET status = 'expired', updated_at = NOW()
     WHERE status = 'active'
       AND token_expires_at IS NOT NULL
       AND token_expires_at <= NOW()
     RETURNING id, app_id, institution_id, institution_name`,
  );

  for (const row of expired) {
    await queueWebhookEvent(row.app_id, {
      eventType: "token.expired",
      institutionId: row.institution_id,
      appId: row.app_id,
      timestamp: new Date().toISOString(),
      data: {
        institution: row.institution_name,
        reason: "access_token_expired",
      },
    });
  }

  if (expired.length > 0) {
    logger.info("Expired tokens swept", { count: expired.length });
  }
  return expired.length;
}
