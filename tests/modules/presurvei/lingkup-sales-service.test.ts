import { describe, expect, it, vi } from "vitest";

import { LingkupSalesService } from "@/modules/presurvei";

/**
 * Satu definisi "sales mana yang boleh saya lihat" untuk rencana, prospek, dan
 * canvasing. Sebelumnya hanya rencana yang mengenal tingkat TIM, sehingga
 * kepala sales mengatur agenda timnya tapi tidak melihat prospek maupun
 * canvasing anggotanya.
 */

const buatService = (anggota: string[] = []) => {
  const anggotaTim = vi.fn().mockResolvedValue(anggota);
  const service = new LingkupSalesService({
    anggotaTim,
  } as unknown as ConstructorParameters<typeof LingkupSalesService>[0]);
  return { service, anggotaTim };
};

const konteks = (permissions: string[]) => ({
  penggunaId: "sales-1",
  tenantId: "tenant-1",
  permissions,
});

describe("LingkupSalesService.idSalesTerlihat", () => {
  it("admin tidak dibatasi sama sekali", async () => {
    const { service, anggotaTim } = buatService();

    await expect(
      service.idSalesTerlihat(konteks(["presurvei_rencana:view_all"])),
    ).resolves.toBeUndefined();
    await expect(
      service.idSalesTerlihat(konteks(["*"])),
    ).resolves.toBeUndefined();

    // Tanpa batas berarti tak perlu menanyakan anggota tim ke database.
    expect(anggotaTim).not.toHaveBeenCalled();
  });

  it("sales biasa hanya dirinya sendiri", async () => {
    const { service, anggotaTim } = buatService(["tidak-dipakai"]);

    await expect(
      service.idSalesTerlihat(konteks(["m_presurvei:read"])),
    ).resolves.toEqual(["sales-1"]);
    expect(anggotaTim).not.toHaveBeenCalled();
  });

  it("kepala sales mencakup dirinya dan anggota timnya", async () => {
    const { service, anggotaTim } = buatService(["sales-2", "sales-3"]);

    await expect(
      service.idSalesTerlihat(konteks(["presurvei_rencana:create"])),
    ).resolves.toEqual(["sales-1", "sales-2", "sales-3"]);
    expect(anggotaTim).toHaveBeenCalledWith("sales-1", "tenant-1");
  });

  it("kepala sales tanpa anggota tetap melihat dirinya, bukan kosong", async () => {
    const { service } = buatService([]);

    await expect(
      service.idSalesTerlihat(konteks(["presurvei_rencana:create"])),
    ).resolves.toEqual(["sales-1"]);
  });

  /**
   * `undefined` berarti "tanpa batas", array kosong berarti "tidak ada satu
   * pun". Menukarnya akan membuka seluruh tenant kepada orang yang semestinya
   * tidak melihat apa pun, jadi perbedaannya dikunci di sini.
   */
  it("tidak pernah menjawab array kosong untuk pemanggil terbatas", async () => {
    const { service } = buatService([]);

    for (const izin of [
      ["m_presurvei:read"],
      ["presurvei_rencana:read"],
      ["presurvei_rencana:create"],
    ]) {
      const hasil = await service.idSalesTerlihat(konteks(izin));
      expect(hasil).not.toEqual([]);
      expect(hasil).toContain("sales-1");
    }
  });

  /**
   * Regresi: izin "lihat semua" tiap modul berdiri sendiri — canvasing memakai
   * `canvasing:read`, prospek `presurvei:read`, lingkup ini
   * `presurvei_rencana:view_all`. Bila modul pemanggil sudah menolak melihat
   * milik orang lain, jawaban "tanpa batas" dari sini pernah membatalkan
   * penolakan itu dan membuka seluruh tenant.
   */
  describe("idSalesTerlihatTanpaMelebarkan", () => {
    it.each([["presurvei_rencana:view_all"], ["*"]])(
      "mengerucutkan %s ke milik sendiri, bukan tanpa batas",
      async (izin) => {
        const { service } = buatService(["sales-2"]);

        await expect(
          service.idSalesTerlihatTanpaMelebarkan(konteks([izin])),
        ).resolves.toEqual(["sales-1"]);
      },
    );

    it("tetap membuka lingkup tim untuk kepala sales", async () => {
      const { service } = buatService(["sales-2", "sales-3"]);

      await expect(
        service.idSalesTerlihatTanpaMelebarkan(
          konteks(["presurvei_rencana:create"]),
        ),
      ).resolves.toEqual(["sales-1", "sales-2", "sales-3"]);
    });

    it("tanpa tenant jatuh ke milik sendiri, tidak melebar", async () => {
      const { service, anggotaTim } = buatService(["sales-2"]);

      for (const tenantId of [null, undefined, ""]) {
        await expect(
          service.idSalesTerlihatTanpaMelebarkan({
            penggunaId: "sales-1",
            tenantId,
            permissions: ["presurvei_rencana:create"],
          }),
        ).resolves.toEqual(["sales-1"]);
      }
      expect(anggotaTim).not.toHaveBeenCalled();
    });

    it("tidak pernah menjawab kosong", async () => {
      const { service } = buatService([]);

      for (const izin of [
        ["m_presurvei:read"],
        ["presurvei_rencana:read"],
        ["presurvei_rencana:create"],
        ["presurvei_rencana:view_all"],
        ["*"],
      ]) {
        await expect(
          service.idSalesTerlihatTanpaMelebarkan(konteks(izin)),
        ).resolves.toEqual(["sales-1"]);
      }
    });
  });

  it("izin rencana selain create belum membuka lingkup tim", async () => {
    const { service, anggotaTim } = buatService(["sales-2"]);

    await expect(
      service.idSalesTerlihat(konteks(["presurvei_rencana:read"])),
    ).resolves.toEqual(["sales-1"]);
    expect(anggotaTim).not.toHaveBeenCalled();
  });
});
