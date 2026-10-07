import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTenantSettingsMap: vi.fn(),
  upsertTenantSettings: vi.fn(),
  getGeneralSettings: vi.fn(),
}));

vi.mock("@/modules/settings", () => ({
  getTenantSettingsMap: mocks.getTenantSettingsMap,
  upsertTenantSettings: mocks.upsertTenantSettings,
  getGeneralSettings: mocks.getGeneralSettings,
}));

import { SettingsDocumentStore } from "@/modules/regulatory/services/settings-document-store";

/**
 * Satu tenant bisa memegang izin Jartaplok PS dan ISP sekaligus. Isiannya
 * dipisah lewat akhiran kunci; Jartaplok sengaja memakai kunci tanpa akhiran
 * agar tenant yang sudah mengisi sebelum ISP ada tidak kehilangan datanya.
 */

const store = new SettingsDocumentStore();
const kunciDari = (panggilan: { key: string }[]) => panggilan.map((f) => f.key);

describe("pemisahan kunci per jenis izin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantSettingsMap.mockResolvedValue({});
    mocks.upsertTenantSettings.mockResolvedValue(undefined);
  });

  it("Jartaplok memakai kunci warisan tanpa akhiran", async () => {
    await store.getProfile("tenant-1", "JARTAPLOK_PS");

    const kunci = kunciDari(mocks.getTenantSettingsMap.mock.calls[0][1]);
    expect(kunci).toContain("REGULASI_NAMA_PENYELENGGARA");
    expect(kunci.every((k: string) => !k.endsWith("_ISP"))).toBe(true);
  });

  it("ISP memakai kunci berakhiran sendiri", async () => {
    await store.getProfile("tenant-1", "ISP");

    const kunci = kunciDari(mocks.getTenantSettingsMap.mock.calls[0][1]);
    expect(kunci).toContain("REGULASI_NAMA_PENYELENGGARA_ISP");
    expect(kunci).not.toContain("REGULASI_NAMA_PENYELENGGARA");
  });

  it("isian tahunan dipisah per izin", async () => {
    await store.getYearlyInput("tenant-1", "JARTAPLOK_PS", 2026);
    await store.getYearlyInput("tenant-1", "ISP", 2026);

    expect(kunciDari(mocks.getTenantSettingsMap.mock.calls[0][1])).toEqual([
      "REGULASI_SELF_ASSESSMENT_2026",
    ]);
    expect(kunciDari(mocks.getTenantSettingsMap.mock.calls[1][1])).toEqual([
      "REGULASI_SELF_ASSESSMENT_2026_ISP",
    ]);
  });

  it("menyimpan satu izin tidak menyentuh kunci izin lain", async () => {
    await store.saveYearlyInput("tenant-1", "ISP", 2026, {
      manualAchievements: { "seluler.packetLoss": "1,2" },
      supportingLinks: {},
    });

    const ditulis = kunciDari(mocks.upsertTenantSettings.mock.calls[0][1]);
    expect(ditulis).toEqual(["REGULASI_SELF_ASSESSMENT_2026_ISP"]);
  });

  it("profil kedua izin tidak berbagi satu kunci pun", async () => {
    await store.saveProfile("tenant-1", "JARTAPLOK_PS", {} as never);
    await store.saveProfile("tenant-1", "ISP", {} as never);

    const jartaplok = new Set(
      kunciDari(mocks.upsertTenantSettings.mock.calls[0][1]),
    );
    const isp = kunciDari(mocks.upsertTenantSettings.mock.calls[1][1]);

    expect(isp.some((k: string) => jartaplok.has(k))).toBe(false);
  });
});
