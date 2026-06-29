/**
 * BridgeX Canonical Data Models
 * All institution adapters normalize to these types regardless of source.
 */

export type InstitutionId =
  "chase" | "wells_fargo" | "bank_of_america" | "barclays" | "revolut";

export interface Institution {
  id: InstitutionId;
  name: string;
  country: string;
  logo: string;
  primaryColor: string;
  oauthSupported: boolean;
}

// Normalized account
export interface Account {
  id: string;
  institutionId: InstitutionId;
  institutionName: string;
  name: string;
  officialName: string | null;
  type: "checking" | "savings" | "credit" | "investment" | "loan";
  subtype: string | null;
  currency: string;
  mask: string; // last 4 digits
  status: "active" | "closed" | "frozen";
}

// Normalized balance
export interface Balance {
  accountId: string;
  current: number;
  available: number | null;
  limit: number | null;
  currency: string;
  updatedAt: string;
}

// Normalized transaction
export interface Transaction {
  id: string;
  accountId: string;
  institutionId: InstitutionId;
  amount: number; // positive = debit, negative = credit
  currency: string;
  description: string;
  merchantName: string | null;
  category: string[];
  subcategory: string | null;
  type: "debit" | "credit";
  status: "posted" | "pending";
  date: string; // ISO8601 date
  authorizedDate: string | null;
  location: TransactionLocation | null;
  paymentChannel: "online" | "in_store" | "other";
}

export interface TransactionLocation {
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
}

// Normalized webhook event
export interface WebhookEvent {
  eventType:
    "transactions.new" | "balance.update" | "account.update" | "token.expired";
  institutionId: InstitutionId;
  appId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// OAuth flow types
export interface OAuthState {
  appId: string;
  institutionId: InstitutionId;
  state: string;
  codeVerifier?: string;
}

export interface TokenRecord {
  id: string;
  appId: string;
  institutionId: InstitutionId;
  institutionName: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  status: "active" | "expired" | "revoked" | "error";
  lastUsedAt: Date | null;
  lastRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
