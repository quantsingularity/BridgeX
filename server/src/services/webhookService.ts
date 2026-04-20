import axios from "axios";
import { query, queryOne } from "../db";
import { hmacSign } from "../utils/crypto";
import { WebhookEvent } from "../models/types";
import { config } from "../config";
import { logger } from "../utils/logger";

export async function queueWebhookEvent(
  appId: string,
  event: WebhookEvent,
): Promise<void> {
  await query(
    `INSERT INTO webhook_deliveries (app_id, event_type, payload, status)
     VALUES ($1, $2, $3, 'pending')`,
    [appId, event.eventType, JSON.stringify(event)],
  );
}

export async function deliverPendingWebhooks(): Promise<void> {
  const rows = await query<{
    id: string;
    app_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    attempts: number;
  }>(`
    SELECT wd.id, wd.app_id, wd.event_type, wd.payload, wd.attempts,
           a.webhook_url, a.webhook_secret
    FROM webhook_deliveries wd
    JOIN apps a ON a.id = wd.app_id
    WHERE wd.status IN ('pending','retrying')
      AND (wd.next_retry_at IS NULL OR wd.next_retry_at <= NOW())
      AND a.webhook_url IS NOT NULL
    ORDER BY wd.created_at ASC
    LIMIT 50
  `);

  for (const row of rows as any[]) {
    await deliver(row);
  }
}

async function deliver(row: any): Promise<void> {
  const body = JSON.stringify(row.payload);
  const signature = row.webhook_secret
    ? `sha256=${hmacSign(row.webhook_secret, body)}`
    : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-BridgeX-Event": row.event_type,
    "X-BridgeX-Delivery-Id": row.id,
  };
  if (signature) headers["X-BridgeX-Signature"] = signature;

  try {
    const resp = await axios.post(row.webhook_url, row.payload, {
      headers,
      timeout: config.webhook.timeoutMs,
    });

    await query(
      `UPDATE webhook_deliveries
       SET status='delivered', attempts=attempts+1, response_code=$1,
           response_body=$2, delivered_at=NOW()
       WHERE id=$3`,
      [resp.status, resp.data?.toString()?.slice(0, 500) ?? "", row.id],
    );
    logger.info("Webhook delivered", { id: row.id, status: resp.status });
  } catch (err: any) {
    const nextAttempts = row.attempts + 1;
    const failed = nextAttempts >= config.webhook.maxRetries;
    const nextRetry = failed
      ? null
      : new Date(Date.now() + config.webhook.retryBackoff * nextAttempts);

    await query(
      `UPDATE webhook_deliveries
       SET status=$1, attempts=$2, response_code=$3, response_body=$4, next_retry_at=$5
       WHERE id=$6`,
      [
        failed ? "failed" : "retrying",
        nextAttempts,
        err.response?.status ?? null,
        err.message?.slice(0, 500),
        nextRetry,
        row.id,
      ],
    );
    logger.warn("Webhook delivery failed", {
      id: row.id,
      attempt: nextAttempts,
      error: err.message,
    });
  }
}

export async function getDeliveryLogs(
  appId: string,
  limit = 50,
): Promise<unknown[]> {
  return query(
    `SELECT id, event_type, status, attempts, response_code, delivered_at, created_at
     FROM webhook_deliveries WHERE app_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [appId, limit],
  );
}
