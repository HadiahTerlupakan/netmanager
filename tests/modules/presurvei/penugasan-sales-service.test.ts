import { describe, expect, it, vi } from "vitest";

/**
 * Validasi integritas "sales se-tenant" yang dipakai bersama target dan
 * pemilik prospek. Penolakannya wajib seragam: pesan yang berbeda untuk
 * "bukan sales" dan "tenant lain" membocorkan keberadaan user tenant lain.
 */

import { AppError } from "@/lib/errors";
import type { CalonSales } from "@/modules/presurvei/domain/penugasan-sales";
import type { ISalesRepository } from "@/modules/presurvei/domain/ports/ISalesRepository";
import { PenugasanSalesService } from "@/modules/presurvei/services/PenugasanSalesService";

const TENANT_SESI = "tenant-sesi";
const TENANT_SALES = "tenant-sales";

const calon = (ubahan: Partial<CalonSales> = {}): CalonSales => ({
  id: "sales-1",
  tenantId: TENANT_SALES,
  isSales: true,
  isActive: true,
  ...ubahan,
});

const bangunRepo = (hasil: CalonSales | null): ISalesRepository => ({
  daftarAktif: vi.fn(),
  cariCalonSales: vi.fn().mockResolvedValue(hasil),
});

/** Tangkap penolakan supaya status, kode, dan pesannya bisa dibandingkan. */
async function tangkap(janji: Promise<unknown>): Promise<AppError> {
  const galat = await janji.then(
    (): unknown => null,
    (alasan: unknown): unknown => alasan,
  );
  expect(galat).toBeInstanceOf(AppError);
  return galat as AppError;
}

describe("PenugasanSalesService.pastikanSah", () => {
  it("lolos untuk sales aktif se-tenant dan mencari user yang diminta", async () => {
    const repo = bangunRepo(calon());

    await expect(
      new PenugasanSalesService(repo).pastikanSah("sales-1", TENANT_SALES, {
        isWajibAktif: true,
      }),
    ).resolves.toBeUndefined();
    expect(repo.cariCalonSales).toHaveBeenCalledWith("sales-1");
  });

  it("menolak user bukan-sales, tenant lain, dan tak dikenal dengan pesan yang sama persis", async () => {
    const galat = await Promise.all(
      [calon({ isSales: false }), calon({ tenantId: "tenant-lain" }), null].map(
        (hasil) =>
          tangkap(
            new PenugasanSalesService(bangunRepo(hasil)).pastikanSah(
              "sales-1",
              TENANT_SALES,
              { isWajibAktif: false },
            ),
          ),
      ),
    );

    for (const satu of galat) {
      expect({
        statusCode: satu.statusCode,
        code: satu.code,
        message: satu.message,
      }).toEqual({
        statusCode: 422,
        code: "SALES_TIDAK_SAH",
        message: "Sales tidak ditemukan di tenant ini",
      });
    }
  });

  it("menolak sales nonaktif hanya bila diwajibkan aktif", async () => {
    const repo = bangunRepo(calon({ isActive: false }));
    const service = new PenugasanSalesService(repo);

    await expect(
      service.pastikanSah("sales-1", TENANT_SALES, { isWajibAktif: true }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      service.pastikanSah("sales-1", TENANT_SALES, { isWajibAktif: false }),
    ).resolves.toBeUndefined();
  });
});

describe("PenugasanSalesService.tentukanTenantBaris", () => {
  it("memakai tenant sesi tanpa membaca user bila sesi bertenant", async () => {
    const repo = bangunRepo(calon());

    expect(
      await new PenugasanSalesService(repo).tentukanTenantBaris(
        "sales-1",
        TENANT_SESI,
      ),
    ).toBe(TENANT_SESI);
    expect(repo.cariCalonSales).not.toHaveBeenCalled();
  });

  it("memakai tenant sales bila sesi tak bertenant (super admin)", async () => {
    const repo = bangunRepo(calon());

    expect(
      await new PenugasanSalesService(repo).tentukanTenantBaris(
        "sales-1",
        null,
      ),
    ).toBe(TENANT_SALES);
    expect(repo.cariCalonSales).toHaveBeenCalledWith("sales-1");
  });

  it("mengembalikan null bila user tak dikenal atau tak bertenant", async () => {
    expect(
      await new PenugasanSalesService(bangunRepo(null)).tentukanTenantBaris(
        "hantu",
        null,
      ),
    ).toBeNull();
    expect(
      await new PenugasanSalesService(
        bangunRepo(calon({ tenantId: null })),
      ).tentukanTenantBaris("sales-1", null),
    ).toBeNull();
  });
});
