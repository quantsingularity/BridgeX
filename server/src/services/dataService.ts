/**
 * BridgeX Data Service
 *
 * Unified data access layer. In sandbox mode it returns deterministic mock
 * data from adapters/sandbox.ts. In live mode it decrypts the stored access
 * token and delegates to a registered LiveInstitutionAdapter; if none is
 * registered for the institution it raises a clear, honest error instead of
 * silently returning sandbox data dressed up as live.
 */
import { Account, Balance, InstitutionId, Transaction } from "../models/types";
import {
  generateAccounts,
  generateBalances,
  generateTransactions,
} from "../adapters/sandbox";
import { getLiveAdapter } from "../adapters/liveAdapter";
import { getDecryptedToken } from "./tokenService";
import { config } from "../config";

export async function getAccounts(
  appId: string,
  institutionId: InstitutionId,
  sandbox: boolean = config.sandboxMode,
): Promise<Account[]> {
  if (sandbox) {
    return generateAccounts(institutionId, appId);
  }

  const tokens = await getDecryptedToken(appId, institutionId);
  if (!tokens) {
    throw new Error(`No active token for institution ${institutionId}`);
  }
  return getLiveAdapter(institutionId).getAccounts(tokens.accessToken);
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

  const tokens = await getDecryptedToken(appId, institutionId);
  if (!tokens) {
    throw new Error(`No active token for institution ${institutionId}`);
  }
  return getLiveAdapter(institutionId).getBalances(
    tokens.accessToken,
    accounts,
  );
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

  let allTxns: Transaction[];
  if (sandbox) {
    allTxns = generateTransactions(accounts, appId, 90);
  } else {
    const tokens = await getDecryptedToken(appId, institutionId);
    if (!tokens) {
      throw new Error(`No active token for institution ${institutionId}`);
    }
    allTxns = await getLiveAdapter(institutionId).getTransactions(
      tokens.accessToken,
      accounts,
      {
        startDate: options.startDate,
        endDate: options.endDate,
        accountId: options.accountId,
      },
    );
  }

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
