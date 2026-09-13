import { describe, expect, it } from "vitest";

import type { SettingsEntity } from "@/modules/settings/domain/entities/Settings";
import { mapAcsSettingsResponse } from "@/modules/settings/services/acsSettings";

function buatRecord(key: string, value: string | null): SettingsEntity {
  return { key, value, encrypted: false };
}

/**
 * GenieACS tidak dipasang di produksi. Selama `mapAcsSettingsResponse` mengisi
 * default "http://localhost:7557/devices", setiap permintaan ACS menabrak
 * ECONNREFUSED dan endpoint mengembalikan 502 — padahal `AcsDeviceService`
 * sudah punya penjaga "belum dikonfigurasi" yang tidak pernah kebagian jalan.
 */
describe("ACS tanpa konfigurasi URL", () => {
  it("mengosongkan genieAcsUrl saat setting tidak ada", () => {
    const settings = mapAcsSettingsResponse([]);

    expect(settings.genieAcsUrl).toBe("");
  });

  it("mengosongkan genieAcsUrl saat nilainya null atau string kosong", () => {
    expect(
      mapAcsSettingsResponse([buatRecord("ACS_GENIEACS_URL", null)])
        .genieAcsUrl,
    ).toBe("");
    expect(
      mapAcsSettingsResponse([buatRecord("ACS_GENIEACS_URL", "")]).genieAcsUrl,
    ).toBe("");
  });

  it("tidak pernah mengembalikan alamat localhost sebagai default", () => {
    // Penjaga eksplisit: default lingkungan pengembangan tidak boleh kembali
    // menyelinap ke payload yang dipakai produksi.
    expect(mapAcsSettingsResponse([]).genieAcsUrl).not.toContain("localhost");
  });

  it("memakai URL dari Pengaturan ketika diisi", () => {
    const settings = mapAcsSettingsResponse([
      buatRecord("ACS_GENIEACS_URL", "https://acs.example.com/devices"),
    ]);

    expect(settings.genieAcsUrl).toBe("https://acs.example.com/devices");
  });

  it("tetap memberi default yang wajar untuk setting non-jaringan", () => {
    // Default lain tidak ikut dicabut — yang berbahaya hanya alamat jaringan.
    const settings = mapAcsSettingsResponse([]);

    expect(settings.appName).toBe("SolusiDigitalNet");
    expect(settings.vpRxPower).toBe("VirtualParameters.RXPower");
  });
});
