import { logger } from "@/lib/logger";
// Encryption utility for sensitive data (API keys)

import crypto from "crypto";

// IMPORTANT: Set this in your .env file (any string, will be hashed to 32 bytes)
// For better security, use: node -e "logger.info(crypto.randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-key-please-change-in-production";
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Get a 32-byte encryption key from the ENCRYPTION_KEY string
 */
function getEncryptionKey(): Buffer {
  // Use scrypt to derive a 32-byte key from any string
  // This ensures we always have exactly 32 bytes regardless of input
  return crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
}

/**
 * Encrypt a string (e.g., API key)
 */
export function encryptApiKey(text: string): string {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return iv:encrypted format
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 */
export function decryptApiKey(encryptedText: string): string {
  try {
    const key = getEncryptionKey();

    // Split iv and encrypted data
    const [ivHex, encryptedHex] = encryptedText.split(":");
    if (!ivHex || !encryptedHex) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const encrypted = encryptedHex;

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error("Decryption error:", error);
    throw new Error("Gagal mendekripsi API key");
  }
}

/**
 * Generate a random encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
