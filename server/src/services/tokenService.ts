import { query, queryOne } from "../db";
import { encrypt, decrypt } from "../utils/crypto";
import { TokenRecord, InstitutionId } from "../models/types";
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
  const row = await queryOne<TokenRecord>(
    `
    SELECT * FROM institution_tokens
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
    accessToken: decrypt(row.encryptedAccessToken as unknown as string),
    refreshToken: row.encryptedRefreshToken
      ? decrypt(row.encryptedRefreshToken as unknown as string)
      : null,
  };
}

export async function listTokensForApp(
  appId: string,
): Promise<
  Omit<TokenRecord, "encryptedAccessToken" | "encryptedRefreshToken">[]
> {
  return query(
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
