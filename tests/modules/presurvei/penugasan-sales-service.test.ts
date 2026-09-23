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
  it("lolos untuk sales aktif se-tenant dan mengembalikan tenant barisnya", async () => {
    const repo = bangunRepo(calon());
    const service = new PenugasanSalesService(repo);

    const penugasan = await service.muatUntukBaris("sales-1", TENANT_SALES);

    expect(service.pastikanSah(penugasan, { isWajibAktif: true })).toBe(
      TENANT_SALES,
    );
    expect(repo.cariCalonSales).toHaveBeenCalledWith("sales-1");
  });

  it("menolak user bukan-sales, tenant lain, dan tak dikenal dengan pesan yang sama persis", async () => {
    const galat = await Promise.all(
      [calon({ isSales: false }), calon({ tenantId: "tenant-lain" }), null].map(
        async (hasil) => {
          const service = new PenugasanSalesService(bangunRepo(hasil));
          const penugasan = await service.muatUntukBaris(
            "sales-1",
            TENANT_SALES,
          );
          return tangkap(
            Promise.resolve().then(() =>
              service.pastikanSah(penugasan, { isWajibAktif: false }),
            ),
          );
        },
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
    const service = new PenugasanSalesService(
      bangunRepo(calon({ isActive: false })),
    );
    const penugasan = await service.muatUntukBaris("sales-1", TENANT_SALES);

    expect(() =>
      service.pastikanSah(penugasan, { isWajibAktif: true }),
    ).toThrow(AppError);
    expect(service.pastikanSah(penugasan, { isWajibAktif: false })).toBe(
      TENANT_SALES,
    );
  });
});

describe("PenugasanSalesService.muatUntukBarisBaru", () => {
  it("memakai tenant sesi bila sesi bertenant", async () => {
    const repo = bangunRepo(calon());

    const penugasan = await new PenugasanSalesService(repo).muatUntukBarisBaru(
      "sales-1",
      TENANT_SESI,
    );

    expect(penugasan.tenantBaris).toBe(TENANT_SESI);
    expect(repo.cariCalonSales).toHaveBeenCalledTimes(1);
  });

  it("memakai tenant sales bila sesi tak bertenant — dengan SATU pemuatan user", async () => {
    const repo = bangunRepo(calon());
    const service = new PenugasanSalesService(repo);

    const penugasan = await service.muatUntukBarisBaru("sales-1", null);
    service.pastikanSah(penugasan, { isWajibAktif: true });

    expect(penugasan.tenantBaris).toBe(TENANT_SALES);
    expect(repo.cariCalonSales).toHaveBeenCalledTimes(1);
    expect(repo.cariCalonSales).toHaveBeenCalledWith("sales-1");
  });

  it("tenant baris null bila user tak dikenal atau tak bertenant", async () => {
    expect(
      (
        await new PenugasanSalesService(bangunRepo(null)).muatUntukBarisBaru(
          "hantu",
          null,
        )
      ).tenantBaris,
    ).toBeNull();
    expect(
      (
        await new PenugasanSalesService(
          bangunRepo(calon({ tenantId: null })),
        ).muatUntukBarisBaru("sales-1", null)
      ).tenantBaris,
    ).toBeNull();
  });
});

describe("PenugasanSalesService.muatUntukBaris", () => {
  it("tidak pernah jatuh ke tenant sales bila tenant baris kosong", async () => {
    // Prospek lama bertenant null tidak boleh "mengadopsi" tenant sales yang
    // ditugaskan kepadanya.
    const service = new PenugasanSalesService(bangunRepo(calon()));

    const penugasan = await service.muatUntukBaris("sales-1", null);

    expect(penugasan.tenantBaris).toBeNull();
    expect(() =>
      service.pastikanSah(penugasan, { isWajibAktif: false }),
    ).toThrow(AppError);
  });
});
