import { describe, expect, it } from "vitest";
import { isTokenRevoked } from "@/lib/auth/token-freshness";

describe("isTokenRevoked", () => {
  // Regresi: verifyAuth (penjaga route withAuth/withPermission) tidak pernah
  // memeriksa tokenVersion — 0 kemunculan di lib/auth/helpers.ts, berbanding
  // 8 di callbacks.ts dan 29 di mobile-auth.ts. Akibatnya status superadmin
  // yang dicabut tetap berlaku sampai cookie kedaluwarsa: pencabutan akses
  // praktis tidak mungkin.
  it("menganggap token dicabut saat versi DB lebih tinggi", () => {
    expect(
      isTokenRevoked({
        tokenVersion: 3,
        storedTokenVersion: 4,
        isActive: true,
      }),
    ).toBe(true);
  });

  it("menerima token dengan versi yang sama", () => {
    expect(
      isTokenRevoked({
        tokenVersion: 4,
        storedTokenVersion: 4,
        isActive: true,
      }),
    ).toBe(false);
  });

  it("menolak user yang dinonaktifkan", () => {
    expect(
      isTokenRevoked({
        tokenVersion: 4,
        storedTokenVersion: 4,
        isActive: false,
      }),
    ).toBe(true);
  });

  // Token lama terbit sebelum klaim tokenVersion ada; jangan mengunci mereka
  // hanya karena klaimnya absen, selama versi DB masih 0.
  it("memperlakukan klaim yang absen sebagai versi 0", () => {
    expect(isTokenRevoked({ storedTokenVersion: 0, isActive: true })).toBe(
      false,
    );
    expect(isTokenRevoked({ storedTokenVersion: 1, isActive: true })).toBe(
      true,
    );
  });

  // Bila data pembanding tidak tersedia (cache/DB gagal), jangan memutus sesi
  // yang sah — kegagalan infrastruktur bukan alasan mengunci semua orang.
  it("tidak mencabut saat data pembanding tidak tersedia", () => {
    expect(isTokenRevoked({ tokenVersion: 4 })).toBe(false);
  });
});
