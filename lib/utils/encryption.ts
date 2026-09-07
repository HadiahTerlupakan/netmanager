import crypto from "crypto";
import { logger } from "@/lib/logger";

/**
 * Enkripsi data sensitif yang disimpan di database (API key, kredensial SMTP,
 * kredensial WhatsApp, payment gateway, dan sejenisnya).
 *
 * Kunci diambil dari `ENCRYPTION_KEY`. Sebelum variabel itu dipasang, seluruh
 * ciphertext produksi terbentuk memakai kunci cadangan yang nilainya ada di
 * dalam repo ini — jadi sekadar mengisi `ENCRYPTION_KEY` akan membuat semua
 * data lama tidak bisa dibaca lagi.
 *
 * Karena itu dekripsi mencoba beberapa kunci berurutan: kunci aktif dulu, lalu
 * kunci lama. Enkripsi selalu memakai kunci aktif, sehingga data berpindah ke
 * kunci baru dengan sendirinya setiap kali disimpan ulang, dan
 * `scripts/reencrypt-secrets.ts` bisa memindahkan sisanya sekaligus.
 */

/** Kunci yang dipakai sebelum `ENCRYPTION_KEY` diperkenalkan. */
const LEGACY_ENCRYPTION_KEY = "default-key-please-change-in-production";

/**
 * Nilai yang berarti "belum diisi", bukan kunci sungguhan.
 *
 * Template secret memakai penanda ini. Kalau ia sampai terpasang sebagai nilai
 * env, kunci itu akan terlihat sah padahal isinya diketahui publik — dan
 * peringatan kunci cadangan justru berhenti muncul karena nilainya berbeda
 * dari kunci lama. Diperlakukan sama dengan tidak diset.
 */
const PLACEHOLDER_KEY_VALUES = new Set([
  "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY",
  "changeme",
  "undefined",
  "null",
]);

const IV_LENGTH = 16; // AES selalu 16 byte
const KEY_LENGTH = 32; // AES-256
const KEY_DERIVATION_SALT = "salt";

function getPrimaryKeySource(): string {
  const configured = process.env.ENCRYPTION_KEY?.trim();

  if (!configured || PLACEHOLDER_KEY_VALUES.has(configured)) {
    return LEGACY_ENCRYPTION_KEY;
  }

  return configured;
}

/** Apakah proses ini masih memakai kunci cadangan yang bocor di repo? */
export function isUsingLegacyEncryptionKey(): boolean {
  return getPrimaryKeySource() === LEGACY_ENCRYPTION_KEY;
}

/**
 * Urutan kunci yang dicoba saat dekripsi: kunci aktif lebih dulu, lalu kunci
 * lama supaya ciphertext lama tetap terbaca selama masa peralihan.
 */
function getDecryptionKeySources(): string[] {
  const primary = getPrimaryKeySource();
  if (primary === LEGACY_ENCRYPTION_KEY) return [primary];

  return [primary, LEGACY_ENCRYPTION_KEY];
}

function deriveKey(source: string): Buffer {
  return crypto.scryptSync(source, KEY_DERIVATION_SALT, KEY_LENGTH);
}

function splitEncryptedText(encryptedText: string): [Buffer, string] {
  const [ivHex, encryptedHex] = encryptedText.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Format ciphertext tidak dikenali");
  }

  return [Buffer.from(ivHex, "hex"), encryptedHex];
}

function decryptWithKey(
  iv: Buffer,
  encryptedHex: string,
  keySource: string,
): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    deriveKey(keySource),
    iv,
  );

  return decipher.update(encryptedHex, "hex", "utf8") + decipher.final("utf8");
}

/** Enkripsi nilai sensitif memakai kunci aktif. */
export function encryptApiKey(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    deriveKey(getPrimaryKeySource()),
    iv,
  );

  const encrypted = cipher.update(text, "utf8", "hex") + cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

/** Dekripsi nilai sensitif, mencoba kunci aktif lalu kunci lama. */
export function decryptApiKey(encryptedText: string): string {
  const [iv, encryptedHex] = splitEncryptedText(encryptedText);

  for (const keySource of getDecryptionKeySources()) {
    try {
      return decryptWithKey(iv, encryptedHex, keySource);
    } catch {
      // Kunci ini tidak cocok; coba kunci berikutnya.
    }
  }

  // Isi ciphertext tidak pernah ikut dicatat — yang berguna hanyalah fakta
  // bahwa tidak ada kunci yang cocok.
  logger.error("Dekripsi gagal: tidak ada kunci yang cocok untuk ciphertext");
  throw new Error("Gagal mendekripsi API key");
}

/**
 * Apakah ciphertext ini masih terikat kunci lama?
 *
 * Dipakai skrip enkripsi ulang untuk memilih baris yang perlu dipindahkan.
 */
export function isEncryptedWithLegacyKey(encryptedText: string): boolean {
  if (isUsingLegacyEncryptionKey()) return false;

  const [iv, encryptedHex] = splitEncryptedText(encryptedText);

  try {
    decryptWithKey(iv, encryptedHex, getPrimaryKeySource());
    return false;
  } catch {
    // Gagal dengan kunci aktif; cek apakah kunci lama yang cocok.
  }

  try {
    decryptWithKey(iv, encryptedHex, LEGACY_ENCRYPTION_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Buat kunci acak untuk mengisi `ENCRYPTION_KEY`. */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
