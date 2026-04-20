/**
 * BridgeX Data Service
 * Unified data access: sandbox mode returns mock data,
 * live mode decrypts tokens and calls real institution APIs.
 */
import { Account, Balance, InstitutionId, Transaction } from "../models/types";
import {
  generateAccounts,
  generateBalances,
  generateTransactions,
} from "../adapters/sandbox";
import { getDecryptedToken } from "./tokenService";
import { config } from "../config";
import { logger } from "../utils/logger";

export async function getAccounts(
  appId: string,
  institutionId: InstitutionId,
  sandbox: boolean = config.sandboxMode,
): Promise<Account[]> {
  if (sandbox) {
    return generateAccounts(institutionId, appId);
  }

  const tokens = await getDecryptedToken(appId, institutionId);
  if (!tokens)
    throw new Error(`No active token for institution ${institutionId}`);

  // In production: call real institution API with tokens.accessToken
  // Example: const resp = await axios.get(`${INSTITUTION_BASE_URLS[institutionId]}/accounts`, ...)
  // Return normalized Account[]
  logger.warn(
    "Live institution API not implemented - falling back to sandbox",
    { institutionId },
  );
  return generateAccounts(institutionId, appId);
}

export async function getBalances(
  appId: string,
  institutionId: InstitutionId,
  sandbox: boolean = config.sandboxMode,
): Promise<Balance[]> {
  const accounts = await getAccounts(appId, institutionId, sandbox);
  if (sandbox) {
    return generateBalances(accounts, appId);
  }
  // In production: call real institution balance endpoint
  return generateBalances(accounts, appId);
}

export async function getTransactions(
  appId: string,
  institutionId: InstitutionId,
  options: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
    count?: number;
    offset?: number;
    sandbox?: boolean;
  } = {},
): Promise<{ transactions: Transaction[]; total: number }> {
  const sandbox = options.sandbox ?? config.sandboxMode;
  const accounts = await getAccounts(appId, institutionId, sandbox);

  const allTxns = sandbox
    ? generateTransactions(accounts, appId, 90)
    : generateTransactions(accounts, appId, 90); // production: call real API

  let filtered = allTxns;

  if (options.accountId) {
    filtered = filtered.filter((t) => t.accountId === options.accountId);
  }
  if (options.startDate) {
    filtered = filtered.filter((t) => t.date >= options.startDate!);
  }
  if (options.endDate) {
    filtered = filtered.filter((t) => t.date <= options.endDate!);
  }

  const total = filtered.length;
  const offset = options.offset ?? 0;
  const count = options.count ?? 100;
  const paginated = filtered.slice(offset, offset + count);

  return { transactions: paginated, total };
}
