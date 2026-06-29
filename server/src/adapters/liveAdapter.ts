/**
 * BridgeX Live Adapter Registry
 *
 * Sandbox mode is fully implemented in adapters/sandbox.ts. Real institution
 * integrations (Chase, Wells Fargo, etc.) require per-bank OAuth client
 * credentials and API contracts that cannot be shipped in an open-source repo.
 *
 * Rather than silently return sandbox data while pretending it is live (which
 * is misleading), live institutions resolve through this registry. Register a
 * concrete adapter per institution at boot to enable live mode; until then,
 * live requests fail loudly with a clear, actionable error.
 */
import { Account, Balance, InstitutionId, Transaction } from "../models/types";

export interface LiveInstitutionAdapter {
  getAccounts(accessToken: string): Promise<Account[]>;
  getBalances(accessToken: string, accounts: Account[]): Promise<Balance[]>;
  getTransactions(
    accessToken: string,
    accounts: Account[],
    options: { startDate?: string; endDate?: string; accountId?: string },
  ): Promise<Transaction[]>;
}

const REGISTRY: Partial<Record<InstitutionId, LiveInstitutionAdapter>> = {};

export function registerLiveAdapter(
  institutionId: InstitutionId,
  adapter: LiveInstitutionAdapter,
): void {
  REGISTRY[institutionId] = adapter;
}

export function getLiveAdapter(
  institutionId: InstitutionId,
): LiveInstitutionAdapter {
  const adapter = REGISTRY[institutionId];
  if (!adapter) {
    throw new Error(
      `Live data for "${institutionId}" is not configured. ` +
        `Register a LiveInstitutionAdapter via registerLiveAdapter(), or use a sandbox app.`,
    );
  }
  return adapter;
}

export function hasLiveAdapter(institutionId: InstitutionId): boolean {
  return Boolean(REGISTRY[institutionId]);
}
