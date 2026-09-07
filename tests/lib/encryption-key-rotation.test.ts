import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `ENCRYPTION_KEY` tidak pernah dipasang di produksi, sehingga seluruh
 * ciphertext yang ada terbentuk memakai kunci cadangan yang nilainya tertulis
 * di repo ini. Terverifikasi lewat `printenv` di pod: variabel itu tidak ada.
 *
 * Konsekuensinya, mengisi `ENCRYPTION_KEY` tanpa jalur peralihan akan membuat
 * kredensial WhatsApp, SMTP, payment gateway, dan R2 mendadak tidak terbaca.
 * Karena itu dekripsi wajib mencoba kunci lama sebagai cadangan, sementara
 * enkripsi selalu memakai kunci aktif.
 */

const LEGACY_KEY = "default-key-please-change-in-production";
const NEW_KEY = "kunci-baru-yang-panjang-dan-acak-123456";

async function loadModule(encryptionKey?: string) {
  vi.resetModules();
  if (encryptionKey === undefined) {
    vi.stubEnv("ENCRYPTION_KEY", "");
  } else {
    vi.stubEnv("ENCRYPTION_KEY", encryptionKey);
  }

  return import("@/lib/utils/encryption");
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("enkripsi dengan kunci aktif", () => {
  it("bolak-balik pada kunci yang sama", async () => {
    const { encryptApiKey, decryptApiKey } = await loadModule(NEW_KEY);

    expect(decryptApiKey(encryptApiKey("rahasia-abc"))).toBe("rahasia-abc");
  });

  it("menghasilkan ciphertext berbeda untuk teks sama (IV acak)", async () => {
    const { encryptApiKey } = await loadModule(NEW_KEY);

    expect(encryptApiKey("rahasia-abc")).not.toBe(encryptApiKey("rahasia-abc"));
  });
});

describe("peralihan kunci", () => {
  it("tetap membaca ciphertext lama setelah kunci diganti", async () => {
    const legacy = await loadModule(undefined);
    const ciphertextLama = legacy.encryptApiKey("kredensial-lama");

    const rotated = await loadModule(NEW_KEY);

    expect(rotated.decryptApiKey(ciphertextLama)).toBe("kredensial-lama");
  });

  // Data harus berpindah ke kunci baru dengan sendirinya setiap kali disimpan
  // ulang; kalau tidak, kunci lama tidak akan pernah bisa dipensiunkan.
  it("menulis ciphertext baru dengan kunci aktif, bukan kunci lama", async () => {
    const rotated = await loadModule(NEW_KEY);
    const ciphertextBaru = rotated.encryptApiKey("kredensial-baru");

    const legacyOnly = await loadModule(undefined);

    expect(() => legacyOnly.decryptApiKey(ciphertextBaru)).toThrow();
  });

  it("mengenali ciphertext yang masih terikat kunci lama", async () => {
    const legacy = await loadModule(undefined);
    const ciphertextLama = legacy.encryptApiKey("kredensial-lama");

    const rotated = await loadModule(NEW_KEY);

    expect(rotated.isEncryptedWithLegacyKey(ciphertextLama)).toBe(true);
    expect(
      rotated.isEncryptedWithLegacyKey(rotated.encryptApiKey("baru")),
    ).toBe(false);
  });
});

describe("diagnostik kunci", () => {
  it("melaporkan saat masih memakai kunci cadangan", async () => {
    const legacy = await loadModule(undefined);

    expect(legacy.isUsingLegacyEncryptionKey()).toBe(true);
  });

  it("melaporkan saat kunci aktif sudah dipasang", async () => {
    const rotated = await loadModule(NEW_KEY);

    expect(rotated.isUsingLegacyEncryptionKey()).toBe(false);
  });

  // Ciphertext rusak tidak boleh diam-diam mengembalikan string kosong.
  it("melempar saat tidak ada kunci yang cocok", async () => {
    const rotated = await loadModule(NEW_KEY);

    expect(() => rotated.decryptApiKey("abcdef:0011")).toThrow(
      /Gagal mendekripsi/,
    );
  });

  it("melempar saat format ciphertext tidak dikenali", async () => {
    const rotated = await loadModule(NEW_KEY);

    expect(() => rotated.decryptApiKey("bukan-ciphertext")).toThrow();
  });
});

describe("generateEncryptionKey", () => {
  it("menghasilkan kunci hex 64 karakter", async () => {
    const { generateEncryptionKey } = await loadModule(NEW_KEY);
    const key = generateEncryptionKey();

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toBe(LEGACY_KEY);
  });
});
