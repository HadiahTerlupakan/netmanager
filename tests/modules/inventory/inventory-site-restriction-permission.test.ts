import { describe, expect, it } from "vitest";

import { isInventorySiteRestricted } from "@/modules/inventory/utils/validation";

/**
 * Pembatasan site pada inventory mobile dulu diputuskan oleh keberadaan
 * permission `k_barang:site_only`. Nama itu tidak pernah ada: seed maupun basis
 * data hanya mengenal `barang`, `m_barang`, `m_barang_masuk`, `m_barang_keluar`.
 *
 * Sebuah pemeriksaan yang menyebut nama yang tidak pernah bisa dimiliki siapa
 * pun selalu mengembalikan false, dan seluruh mesin di bawahnya —
 * `ensureMobileAssignedSite` yang gagal-tertutup, `getMobileScopedSiteIds` yang
 * menyaring — tidak pernah menyala. Toggle "Batasi ke Site Sendiri" di panel
 * admin menyala, tetapi teknisi tetap bisa menarik stok dari gudang site lain.
 *
 * Terbukti saat QA 8 Okt 2026: teknisi bersite Headquarters ditawari dan
 * berhasil memakai Gudang Jakarta Selatan.
 */

const BUKAN_MITRA = { actorType: "user" as const, isSuperAdmin: false };

describe("pembatasan site inventory", () => {
  it("membatasi pemegang m_barang:site_only", () => {
    expect(
      isInventorySiteRestricted({
        ...BUKAN_MITRA,
        permissions: ["m_barang:read", "m_barang:site_only"],
      }),
    ).toBe(true);
  });

  it("tidak membatasi yang tidak memegang toggle itu", () => {
    expect(
      isInventorySiteRestricted({
        ...BUKAN_MITRA,
        permissions: ["m_barang:read"],
      }),
    ).toBe(false);
  });

  // Penjaga atas kesalahan yang baru saja diperbaiki: nama berawalan `k_barang`
  // tidak pernah dibuat, jadi memakainya sama dengan tidak membatasi apa pun.
  it("tidak terkecoh oleh nama permission yang tidak pernah ada", () => {
    expect(
      isInventorySiteRestricted({
        ...BUKAN_MITRA,
        permissions: ["k_barang:site_only"],
      }),
    ).toBe(false);
  });

  // Mitra selalu terbatas pada site-nya sendiri, apa pun permission-nya.
  it("mitra selalu dibatasi", () => {
    expect(
      isInventorySiteRestricted({
        actorType: "mitra",
        isSuperAdmin: false,
        permissions: [],
      }),
    ).toBe(true);
  });

  it("super admin tidak dibatasi", () => {
    expect(
      isInventorySiteRestricted({
        actorType: "user",
        isSuperAdmin: true,
        permissions: ["m_barang:site_only"],
      }),
    ).toBe(false);
  });
});
