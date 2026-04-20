import {
  encrypt,
  decrypt,
  hmacSign,
  generateSecret,
} from "../src/utils/crypto";
import {
  generateAccounts,
  generateBalances,
  generateTransactions,
} from "../src/adapters/sandbox";
import { listInstitutions, getInstitution } from "../src/adapters/institutions";

// ── Crypto ────────────────────────────────────────────────────────────────────

describe("AES-256 encryption", () => {
  const plaintext = "access_chase_abcdef123456789";

  test("encrypt produces ciphertext in IV:data format", () => {
    const ct = encrypt(plaintext);
    expect(ct).toContain(":");
    const parts = ct.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  test("decrypt recovers original plaintext", () => {
    const ct = encrypt(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
  });

  test("each encryption produces unique ciphertext", () => {
    const ct1 = encrypt(plaintext);
    const ct2 = encrypt(plaintext);
    expect(ct1).not.toBe(ct2); // different IVs
  });

  test("decrypt throws on invalid format", () => {
    expect(() => decrypt("notvalidciphertext")).toThrow();
  });

  test("hmacSign produces consistent 64-char hex", () => {
    const sig = hmacSign("secret", '{"event":"test"}');
    expect(sig).toHaveLength(64);
    expect(hmacSign("secret", '{"event":"test"}')).toBe(sig); // deterministic
  });

  test("hmacSign differs with different secrets", () => {
    const s1 = hmacSign("secret1", "payload");
    const s2 = hmacSign("secret2", "payload");
    expect(s1).not.toBe(s2);
  });

  test("generateSecret returns correct length", () => {
    const s = generateSecret(32);
    expect(s).toHaveLength(64); // 32 bytes = 64 hex chars
  });
});

// ── Institution registry ──────────────────────────────────────────────────────

describe("Institution registry", () => {
  test("listInstitutions returns exactly 5 institutions", () => {
    const insts = listInstitutions();
    expect(insts).toHaveLength(5);
  });

  test("all institutions have required fields", () => {
    for (const inst of listInstitutions()) {
      expect(inst.id).toBeTruthy();
      expect(inst.name).toBeTruthy();
      expect(inst.country).toMatch(/^[A-Z]{2}$/);
      expect(inst.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof inst.oauthSupported).toBe("boolean");
    }
  });

  test("getInstitution returns correct institution", () => {
    const chase = getInstitution("chase");
    expect(chase?.name).toBe("Chase Bank");
    expect(chase?.country).toBe("US");
  });

  test("getInstitution returns null for unknown id", () => {
    expect(getInstitution("unknown_bank" as any)).toBeNull();
  });

  test("US institutions use USD currency in accounts", () => {
    const accs = generateAccounts("chase", "test-app");
    for (const acc of accs) {
      expect(acc.currency).toBe("USD");
    }
  });

  test("UK institutions use GBP currency", () => {
    const accs = generateAccounts("barclays", "test-app");
    for (const acc of accs) {
      expect(acc.currency).toBe("GBP");
    }
  });
});

// ── Sandbox data generator ────────────────────────────────────────────────────

describe("Sandbox data generator", () => {
  const appId = "test-app-id";

  test("generateAccounts returns accounts for all 5 institutions", () => {
    const institutions = [
      "chase",
      "wells_fargo",
      "bank_of_america",
      "barclays",
      "revolut",
    ] as const;
    for (const inst of institutions) {
      const accounts = generateAccounts(inst, appId);
      expect(accounts.length).toBeGreaterThan(0);
    }
  });

  test("accounts have required normalized fields", () => {
    const accounts = generateAccounts("chase", appId);
    for (const acc of accounts) {
      expect(acc.id).toBeTruthy();
      expect(acc.institutionId).toBe("chase");
      expect(acc.institutionName).toBeTruthy();
      expect(["checking", "savings", "credit", "investment", "loan"]).toContain(
        acc.type,
      );
      expect(acc.mask).toMatch(/^\d{4}$/);
      expect(acc.status).toBe("active");
    }
  });

  test("account IDs are deterministic (same appId = same IDs)", () => {
    const a1 = generateAccounts("chase", appId);
    const a2 = generateAccounts("chase", appId);
    expect(a1.map((a) => a.id)).toEqual(a2.map((a) => a.id));
  });

  test("account IDs differ for different apps", () => {
    const a1 = generateAccounts("chase", "app-1");
    const a2 = generateAccounts("chase", "app-2");
    expect(a1[0].id).not.toBe(a2[0].id);
  });

  test("generateBalances matches account count", () => {
    const accounts = generateAccounts("wells_fargo", appId);
    const balances = generateBalances(accounts, appId);
    expect(balances).toHaveLength(accounts.length);
  });

  test("balances have correct structure", () => {
    const accounts = generateAccounts("chase", appId);
    const balances = generateBalances(accounts, appId);
    for (const bal of balances) {
      expect(bal.accountId).toBeTruthy();
      expect(typeof bal.current).toBe("number");
      expect(bal.currency).toBeTruthy();
      expect(bal.updatedAt).toBeTruthy();
    }
  });

  test("credit accounts have negative current balance", () => {
    const accounts = generateAccounts("chase", appId);
    const credit = accounts.find((a) => a.type === "credit");
    if (credit) {
      const balances = generateBalances(accounts, appId);
      const cb = balances.find((b) => b.accountId === credit.id);
      expect(cb?.current).toBeLessThan(0);
    }
  });

  test("generateTransactions returns transactions sorted by date desc", () => {
    const accounts = generateAccounts("chase", appId);
    const txns = generateTransactions(accounts, appId, 30);
    expect(txns.length).toBeGreaterThan(0);
    for (let i = 1; i < txns.length; i++) {
      expect(txns[i].date <= txns[i - 1].date).toBe(true);
    }
  });

  test("transactions have required normalized fields", () => {
    const accounts = generateAccounts("revolut", appId);
    const txns = generateTransactions(accounts, appId, 30);
    for (const txn of txns.slice(0, 10)) {
      expect(txn.id).toBeTruthy();
      expect(txn.accountId).toBeTruthy();
      expect(typeof txn.amount).toBe("number");
      expect(["debit", "credit"]).toContain(txn.type);
      expect(["posted", "pending"]).toContain(txn.status);
      expect(txn.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(txn.category)).toBe(true);
    }
  });

  test("transactions debit amounts are positive", () => {
    const accounts = generateAccounts("chase", appId);
    const txns = generateTransactions(accounts, appId, 30);
    const debits = txns.filter((t) => t.type === "debit");
    expect(debits.every((t) => t.amount > 0)).toBe(true);
  });

  test("transactions credit amounts are negative", () => {
    const accounts = generateAccounts("chase", appId);
    const txns = generateTransactions(accounts, appId, 30);
    const credits = txns.filter((t) => t.type === "credit");
    expect(credits.every((t) => t.amount < 0)).toBe(true);
  });
});
