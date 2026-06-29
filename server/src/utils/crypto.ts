/**
 * BridgeX Token Encryption
 * AES-256-CBC encryption for institution access tokens stored in PostgreSQL.
 * Each encrypted value includes a unique IV prepended as hex.
 */
import crypto from "crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-cbc";
// Derive a fixed 32-byte key from the configured secret via SHA-256.
// This guarantees a valid AES-256 key length regardless of how many
// characters ENCRYPTION_KEY contains, avoiding "Invalid key length" crashes.
const KEY_BUFFER = crypto
  .createHash("sha256")
  .update(config.encryption.key, "utf8")
  .digest();
const IV_LENGTH = config.encryption.ivLength;

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  // Format: <iv_hex>:<encrypted_hex>
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid ciphertext format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function generateSecret(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function hmacSign(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
