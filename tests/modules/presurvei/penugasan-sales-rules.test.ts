import { describe, expect, it } from "vitest";

/**
 * Aturan tunggal "boleh ditugasi baris presurvei" — dipakai target dan
 * pemilik prospek. Setiap cabang punya test yang merah bila cabangnya dibuang.
 */

import {
  isCalonSalesSah,
  type CalonSales,
} from "@/modules/presurvei/domain/penugasan-sales";

const TENANT_BARIS = "tenant-baris";

const calon = (ubahan: Partial<CalonSales> = {}): CalonSales => ({
  id: "sales-1",
  tenantId: TENANT_BARIS,
  isSales: true,
  isActive: true,
  ...ubahan,
});

const WAJIB_AKTIF = { isWajibAktif: true };
const BOLEH_NONAKTIF = { isWajibAktif: false };

describe("isCalonSalesSah", () => {
  it("menerima sales aktif dari tenant baris", () => {
    expect(isCalonSalesSah(calon(), TENANT_BARIS, WAJIB_AKTIF)).toBe(true);
  });

  it("menolak user yang tidak ditemukan", () => {
    expect(isCalonSalesSah(null, TENANT_BARIS, WAJIB_AKTIF)).toBe(false);
  });

  it("menolak sales dari tenant lain", () => {
    expect(
      isCalonSalesSah(
        calon({ tenantId: "tenant-lain" }),
        TENANT_BARIS,
        BOLEH_NONAKTIF,
      ),
    ).toBe(false);
  });

  it("menolak user bertenant null walau tenant barisnya juga tak diketahui", () => {
    // null === null akan lolos perbandingan polos; baris tanpa tenant tidak
    // boleh menjadi pintu masuk penugasan lintas-tenant.
    expect(
      isCalonSalesSah(calon({ tenantId: null }), null, BOLEH_NONAKTIF),
    ).toBe(false);
    expect(isCalonSalesSah(calon({ tenantId: "" }), "", BOLEH_NONAKTIF)).toBe(
      false,
    );
  });

  it("menolak user yang bukan sales", () => {
    expect(
      isCalonSalesSah(calon({ isSales: false }), TENANT_BARIS, BOLEH_NONAKTIF),
    ).toBe(false);
  });

  it("menolak sales nonaktif bila penugasannya baru", () => {
    expect(
      isCalonSalesSah(calon({ isActive: false }), TENANT_BARIS, WAJIB_AKTIF),
    ).toBe(false);
  });

  it("menerima sales nonaktif bila penugasannya bukan baru", () => {
    expect(
      isCalonSalesSah(calon({ isActive: false }), TENANT_BARIS, BOLEH_NONAKTIF),
    ).toBe(true);
  });
});
