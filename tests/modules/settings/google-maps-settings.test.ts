import { describe, expect, it, vi } from "vitest";

import type { SettingsEntity } from "@/modules/settings/domain/entities/Settings";
import type { ISettingsRepository } from "@/modules/settings/domain/ports/ISettingsRepository";
import {
  getGoogleMapsSettings,
  getGoogleMapsSettingsUntukKlien,
  isGoogleMapsSiapPakai,
  mapGoogleMapsSettingsResponse,
} from "@/modules/settings/services/googleMapsSettings";

/**
 * Setelan Google Maps.
 *
 * Dua perilaku di sini adalah mode gagal yang hanya terlihat di produksi, dan
 * karena itu dikunci tes: key yang menetes keluar saat fitur belum siap, dan
 * Map ID kosong yang membuat seluruh penanda titik hilang tanpa pesan galat.
 */

function baris(nilai: Record<string, string>): SettingsEntity[] {
  return Object.entries(nilai).map(([key, value]) => ({
    key,
    value,
    encrypted: false,
  }));
}

function repoPalsu(records: SettingsEntity[]): ISettingsRepository {
  return {
    findManyByKeys: vi.fn().mockResolvedValue(records),
    upsertMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteManyByKeys: vi.fn(),
  };
}

const SETELAN_LENGKAP = {
  GOOGLE_MAPS_ENABLED: "true",
  GOOGLE_MAPS_API_KEY: "AIzaKunciUji",
  GOOGLE_MAPS_MAP_ID: "peta-uji-01",
};

describe("mapGoogleMapsSettingsResponse", () => {
  it("membaca ketiga nilainya", () => {
    expect(mapGoogleMapsSettingsResponse(baris(SETELAN_LENGKAP))).toEqual({
      enabled: true,
      apiKey: "AIzaKunciUji",
      mapId: "peta-uji-01",
    });
  });

  it("memangkas spasi yang tersalin saat menempel dari Cloud Console", () => {
    const hasil = mapGoogleMapsSettingsResponse(
      baris({ ...SETELAN_LENGKAP, GOOGLE_MAPS_API_KEY: "  AIzaKunciUji  " }),
    );

    expect(hasil.apiKey).toBe("AIzaKunciUji");
  });

  it("memperlakukan baris yang belum ada sebagai mati", () => {
    expect(mapGoogleMapsSettingsResponse([])).toEqual({
      enabled: false,
      apiKey: "",
      mapId: "",
    });
  });
});

describe("isGoogleMapsSiapPakai", () => {
  it("menolak saklar aktif tanpa Map ID", () => {
    // Tanpa Map ID, AdvancedMarker gagal diam-diam: petanya tampil, seluruh
    // penanda titik tidak, dan tidak ada galat apa pun yang bisa dilacak.
    expect(
      isGoogleMapsSiapPakai({
        enabled: true,
        apiKey: "AIzaKunciUji",
        mapId: "",
      }),
    ).toBe(false);
  });

  it("menolak saklar aktif tanpa API key", () => {
    expect(
      isGoogleMapsSiapPakai({ enabled: true, apiKey: "", mapId: "peta-uji" }),
    ).toBe(false);
  });

  it("menerima hanya saat ketiganya terisi", () => {
    expect(
      isGoogleMapsSiapPakai({
        enabled: true,
        apiKey: "AIzaKunciUji",
        mapId: "peta-uji",
      }),
    ).toBe(true);
  });
});

describe("getGoogleMapsSettingsUntukKlien", () => {
  it("menahan key selama fitur belum aktif", async () => {
    const repo = repoPalsu(
      baris({ ...SETELAN_LENGKAP, GOOGLE_MAPS_ENABLED: "false" }),
    );

    const hasil = await getGoogleMapsSettingsUntukKlien("tenant-1", repo);

    // Key tidak perlu beredar di halaman yang toh tidak akan menampilkan peta.
    expect(hasil).toEqual({ enabled: false, apiKey: "", mapId: "" });
  });

  it("menahan key saat Map ID belum diisi, bukan mengirim peta yang pincang", async () => {
    const repo = repoPalsu(
      baris({ ...SETELAN_LENGKAP, GOOGLE_MAPS_MAP_ID: "" }),
    );

    const hasil = await getGoogleMapsSettingsUntukKlien("tenant-1", repo);

    expect(hasil.apiKey).toBe("");
  });

  it("meneruskan setelan utuh saat sudah siap", async () => {
    const repo = repoPalsu(baris(SETELAN_LENGKAP));

    const hasil = await getGoogleMapsSettingsUntukKlien("tenant-1", repo);

    expect(hasil).toEqual({
      enabled: true,
      apiKey: "AIzaKunciUji",
      mapId: "peta-uji-01",
    });
  });
});

describe("getGoogleMapsSettings", () => {
  it("membaca baris milik tenant yang diminta", async () => {
    const repo = repoPalsu(baris(SETELAN_LENGKAP));

    await getGoogleMapsSettings("tenant-7", repo);

    expect(repo.findManyByKeys).toHaveBeenCalledWith(
      expect.arrayContaining([
        "GOOGLE_MAPS_ENABLED",
        "GOOGLE_MAPS_API_KEY",
        "GOOGLE_MAPS_MAP_ID",
      ]),
      "tenant-7",
    );
  });

  it("tidak menahan apa pun — form administrator butuh nilai apa adanya", async () => {
    const repo = repoPalsu(
      baris({ ...SETELAN_LENGKAP, GOOGLE_MAPS_ENABLED: "false" }),
    );

    const hasil = await getGoogleMapsSettings("tenant-1", repo);

    // Berbeda dari varian klien: administrator harus bisa melihat key yang
    // sudah tersimpan meski fiturnya sedang dimatikan.
    expect(hasil.apiKey).toBe("AIzaKunciUji");
  });
});

describe("integrasi dengan setelan API", () => {
  it("ketiga key ikut dibaca halaman Pengaturan API", async () => {
    const { API_SETTINGS_KEYS } =
      await import("@/modules/settings/services/apiSettings");

    // Formulirnya satu halaman dengan Gemini dan R2; kalau key-nya tidak ikut
    // dibaca, kolomnya tampil kosong setiap halaman dibuka dan menyimpan akan
    // menghapus nilai yang sudah ada.
    expect(API_SETTINGS_KEYS).toEqual(
      expect.arrayContaining([
        "GOOGLE_MAPS_ENABLED",
        "GOOGLE_MAPS_API_KEY",
        "GOOGLE_MAPS_MAP_ID",
      ]),
    );
  });

  it("API key peta tidak ikut disamarkan bersama rahasia lain", async () => {
    const { maskApiSettingsSecrets } =
      await import("@/modules/settings/services/apiSettings");

    const hasil = maskApiSettingsSecrets({
      googleGeminiApiKey: "rahasia-gemini",
      geminiEnabled: true,
      r2AccountId: "akun",
      r2AccessKeyId: "akses",
      r2SecretAccessKey: "rahasia-r2",
      r2BucketName: "ember",
      r2PublicUrl: "https://contoh",
      r2Enabled: true,
      googleMapsEnabled: true,
      googleMapsApiKey: "AIzaKunciUji",
      googleMapsMapId: "peta-uji",
    });

    // Disamarkan, form akan mengirim balik "********" dan menimpa key asli —
    // sementara nilainya toh sudah terbaca di setiap halaman berpeta.
    expect(hasil.googleMapsApiKey).toBe("AIzaKunciUji");
    expect(hasil.googleGeminiApiKey).not.toBe("rahasia-gemini");
  });

  it("menulis ketiganya tanpa enkripsi lewat jalur setelan API", async () => {
    const { buildApiSettingsUpserts } =
      await import("@/modules/settings/services/apiSettings");

    const upserts = buildApiSettingsUpserts({
      googleMapsEnabled: true,
      googleMapsApiKey: " AIzaKunciUji ",
      googleMapsMapId: " peta-uji ",
    });

    const peta = upserts.filter((entri) => entri.key.startsWith("GOOGLE_MAPS"));
    expect(peta).toHaveLength(3);
    expect(peta.every((entri) => entri.encrypted === false)).toBe(true);
    expect(
      peta.find((entri) => entri.key === "GOOGLE_MAPS_API_KEY")?.value,
    ).toBe("AIzaKunciUji");
  });

  it("tidak menyentuh key peta saat payload tidak memuatnya", async () => {
    const { buildApiSettingsUpserts } =
      await import("@/modules/settings/services/apiSettings");

    const upserts = buildApiSettingsUpserts({ geminiEnabled: true });

    expect(upserts.some((entri) => entri.key.startsWith("GOOGLE_MAPS"))).toBe(
      false,
    );
  });
});
