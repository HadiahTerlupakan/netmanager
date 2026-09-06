import { describe, expect, it } from "vitest";
import {
  mapApiSettingsResponse,
  maskApiSettingsSecrets,
  buildApiSettingsUpserts,
} from "@/modules/settings/services/apiSettings";
import {
  SECRET_PLACEHOLDER,
  KEEP_EXISTING_SECRET_TOKEN,
} from "@/modules/settings/constants/secretConstants";
import type { SettingsEntity } from "@/modules/settings/domain/entities/Settings";

/**
 * `GET /api/settings/api` mengirimkan R2 Secret Access Key dan Google Gemini
 * API Key apa adanya ke browser. Form memang menampilkannya sebagai titik-titik
 * dengan tombol mata, tetapi itu hanya kosmetik: nilainya tetap terbaca lewat
 * devtools dan ikut terekam di log jaringan, HAR, atau proxy mana pun.
 *
 * Browser tidak pernah membutuhkan nilai aslinya — form menyimpan kembali
 * placeholder sebagai `KEEP_EXISTING_SECRET_TOKEN`, dan server melewati
 * penulisan saat menerima token itu.
 */
const record = (key: string, value: string | null): SettingsEntity =>
  ({ key, value }) as SettingsEntity;

describe("maskApiSettingsSecrets", () => {
  const settingsOf = (records: SettingsEntity[]) =>
    maskApiSettingsSecrets(mapApiSettingsResponse(records));

  it("tidak pernah mengirim R2 secret asli ke klien", () => {
    expect(
      settingsOf([record("R2_SECRET_ACCESS_KEY", "rahasia-r2-sebenarnya")])
        .r2SecretAccessKey,
    ).toBe(SECRET_PLACEHOLDER);
  });

  it("tidak pernah mengirim Gemini API key asli ke klien", () => {
    expect(
      settingsOf([record("GOOGLE_GEMINI_API_KEY", "AIza-kunci-asli")])
        .googleGeminiApiKey,
    ).toBe(SECRET_PLACEHOLDER);
  });

  // Membedakan "belum diisi" dari "sudah diisi": string kosong memberi tahu UI
  // bahwa memang belum ada rahasia tersimpan.
  it("mengembalikan string kosong saat rahasia belum diisi", () => {
    const payload = settingsOf([
      record("R2_SECRET_ACCESS_KEY", null),
      record("GOOGLE_GEMINI_API_KEY", ""),
    ]);

    expect(payload.r2SecretAccessKey).toBe("");
    expect(payload.googleGeminiApiKey).toBe("");
  });

  // Ini bukan rahasia — tanpanya admin tidak bisa memastikan konfigurasi mana
  // yang sedang aktif.
  it("tetap mengirim field non-rahasia apa adanya", () => {
    const payload = settingsOf([
      record("R2_ACCOUNT_ID", "akun-123"),
      record("R2_BUCKET_NAME", "radpro"),
      record("R2_ENABLED", "true"),
    ]);

    expect(payload.r2AccountId).toBe("akun-123");
    expect(payload.r2BucketName).toBe("radpro");
    expect(payload.r2Enabled).toBe(true);
  });

  // Penyamaran sengaja tidak dilakukan di mapper: `GeminiOcrService` memakai
  // mapper yang sama untuk memanggil Google, dan menyamarkan di sana membuat
  // OCR memanggil API dengan kunci "********".
  it("mapper tetap mengembalikan nilai asli untuk pemakaian server-side", () => {
    const payload = mapApiSettingsResponse([
      record("GOOGLE_GEMINI_API_KEY", "AIza-kunci-asli"),
      record("R2_SECRET_ACCESS_KEY", "rahasia-r2-sebenarnya"),
    ]);

    expect(payload.googleGeminiApiKey).toBe("AIza-kunci-asli");
    expect(payload.r2SecretAccessKey).toBe("rahasia-r2-sebenarnya");
  });
});

describe("buildApiSettingsUpserts — token pertahankan rahasia", () => {
  const keyOf = (entries: ReturnType<typeof buildApiSettingsUpserts>) =>
    entries.map((entry) => entry.key);

  it("tidak menulis ulang Gemini key saat menerima token pertahankan", () => {
    const upserts = buildApiSettingsUpserts({
      googleGeminiApiKey: KEEP_EXISTING_SECRET_TOKEN,
    });

    expect(keyOf(upserts)).not.toContain("GOOGLE_GEMINI_API_KEY");
  });

  it("tidak menulis ulang R2 secret saat menerima token pertahankan", () => {
    const upserts = buildApiSettingsUpserts({
      r2SecretAccessKey: KEEP_EXISTING_SECRET_TOKEN,
    });

    expect(keyOf(upserts)).not.toContain("R2_SECRET_ACCESS_KEY");
  });

  // Kunci baru harus tersimpan terenkripsi, setara perlakuan R2 secret.
  it("menyimpan Gemini key baru dalam keadaan terenkripsi", () => {
    const upserts = buildApiSettingsUpserts({
      googleGeminiApiKey: "AIza-kunci-baru",
    });
    const entry = upserts.find((e) => e.key === "GOOGLE_GEMINI_API_KEY");

    expect(entry?.value).toBe("AIza-kunci-baru");
    expect(entry?.encrypted).toBe(true);
  });
});
