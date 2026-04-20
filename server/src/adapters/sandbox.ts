/**
 * BridgeX Sandbox Data Generator
 * Produces realistic mock accounts, balances, and transactions.
 * Seeded deterministically from institutionId + appId for consistency.
 */
import { v5 as uuidv5 } from "uuid";
import {
  Account,
  Balance,
  InstitutionId,
  Transaction,
  TransactionLocation,
} from "../models/types";
import { INSTITUTIONS } from "./institutions";

const UUID_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function seed(institutionId: string, appId: string, n: number): number {
  const hash = uuidv5(`${institutionId}:${appId}:${n}`, UUID_NS);
  return parseInt(hash.replace(/-/g, "").slice(0, 8), 16) / 0xffffffff;
}

const ACCOUNT_NAMES: Record<InstitutionId, string[]> = {
  chase: ["Chase Total Checking", "Chase Savings", "Chase Freedom Credit Card"],
  wells_fargo: ["Everyday Checking", "Way2Save Savings", "Active Cash Card"],
  bank_of_america: [
    "Advantage Banking",
    "Rewards Savings",
    "Customized Cash Rewards",
  ],
  barclays: [
    "Barclays Current Account",
    "Rainy Day Saver",
    "Barclays Rewards Visa",
  ],
  revolut: ["Revolut Current", "Revolut Savings Vault", "Revolut Premium"],
};

const MERCHANTS = [
  "Amazon",
  "Whole Foods",
  "Starbucks",
  "Netflix",
  "Uber",
  "Spotify",
  "Apple",
  "Shell",
  "Target",
  "Walmart",
  "Delta Airlines",
  "Airbnb",
  "DoorDash",
  "Lyft",
  "Home Depot",
  "Costco",
  "CVS Pharmacy",
  "AT&T",
];

const CATEGORIES = [
  ["Food and Drink", "Restaurants"],
  ["Travel", "Airlines"],
  ["Shopping", "Online Marketplaces"],
  ["Transportation", "Ride Share"],
  ["Entertainment", "Streaming Services"],
  ["Utilities", "Telephone"],
  ["Healthcare", "Pharmacies"],
  ["Groceries", "Supermarkets"],
];

export function generateAccounts(
  institutionId: InstitutionId,
  appId: string,
): Account[] {
  const institution = INSTITUTIONS[institutionId];
  const names = ACCOUNT_NAMES[institutionId];
  const types: Account["type"][] = ["checking", "savings", "credit"];

  return names.map((name, i) => ({
    id: uuidv5(`${institutionId}:${appId}:account:${i}`, UUID_NS),
    institutionId,
    institutionName: institution.name,
    name,
    officialName: name + " Account",
    type: types[i] ?? "checking",
    subtype: null,
    currency:
      institutionId === "barclays" || institutionId === "revolut"
        ? "GBP"
        : "USD",
    mask: String(1000 + Math.floor(seed(institutionId, appId, i) * 9000)).slice(
      -4,
    ),
    status: "active",
  }));
}

export function generateBalances(
  accounts: Account[],
  appId: string,
): Balance[] {
  return accounts.map((acc, i) => {
    const s = seed(acc.institutionId, appId, i + 100);
    const current = acc.type === "credit" ? -(s * 3000) : 500 + s * 25000;
    return {
      accountId: acc.id,
      current: parseFloat(current.toFixed(2)),
      available:
        acc.type === "credit"
          ? parseFloat((5000 + current).toFixed(2))
          : parseFloat((current * 0.98).toFixed(2)),
      limit: acc.type === "credit" ? 5000 : null,
      currency: acc.currency,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function generateTransactions(
  accounts: Account[],
  appId: string,
  days: number = 90,
): Transaction[] {
  const txns: Transaction[] = [];
  const now = new Date();

  for (const acc of accounts) {
    // 10-40 transactions per account over the date range
    const count = 10 + Math.floor(seed(acc.institutionId, appId, 999) * 30);

    for (let i = 0; i < count; i++) {
      const s = seed(
        acc.institutionId,
        appId,
        i * 1000 + accounts.indexOf(acc),
      );
      const daysAgo = Math.floor(s * days);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split("T")[0];

      const merchant = MERCHANTS[Math.floor(s * MERCHANTS.length)];
      const catPair = CATEGORIES[Math.floor(s * CATEGORIES.length)];
      const amount = parseFloat(
        (1 + s * (acc.type === "credit" ? 500 : 200)).toFixed(2),
      );
      const isDebit = acc.type === "credit" ? s > 0.15 : s > 0.2;

      txns.push({
        id: uuidv5(`${acc.id}:txn:${i}`, UUID_NS),
        accountId: acc.id,
        institutionId: acc.institutionId,
        amount: isDebit ? amount : -amount,
        currency: acc.currency,
        description: `${merchant} Purchase`,
        merchantName: merchant,
        category: catPair,
        subcategory: catPair[1] ?? null,
        type: isDebit ? "debit" : "credit",
        status: daysAgo === 0 ? "pending" : "posted",
        date: dateStr,
        authorizedDate: dateStr,
        location: null,
        paymentChannel: s > 0.6 ? "online" : "in_store",
      });
    }
  }

  return txns.sort((a, b) => b.date.localeCompare(a.date));
}
