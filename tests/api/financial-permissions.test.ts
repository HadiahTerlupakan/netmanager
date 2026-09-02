import { describe, expect, it } from "vitest";
import {
  INVOICE_READ_PERMISSIONS,
  INVOICE_WRITE_PERMISSIONS,
  isInvoiceSiteRestricted,
} from "@/lib/api/financial-permissions";

describe("isInvoiceSiteRestricted", () => {
  // Regresi: canOnlyAccessOwnSite memanggil hasPermission() tanpa argumen user,
  // yang jatuh ke getServerSession. Untuk pemanggil Bearer (token mobile) sesi
  // itu null sehingga fungsi selalu mengembalikan false — pembatas site mati
  // justru bagi pemanggil yang paling tidak dipercaya.
  it("membatasi berdasarkan permission dari context, tanpa sesi NextAuth", () => {
    const restricted = isInvoiceSiteRestricted({
      permissions: ["pelanggan:read", "invoices:site_only"],
      user: {},
    });

    expect(restricted).toBe(true);
  });

  it("tidak membatasi bila permission site_only tidak dimiliki", () => {
    const restricted = isInvoiceSiteRestricted({
      permissions: ["pelanggan:read"],
      user: {},
    });

    expect(restricted).toBe(false);
  });

  it("tidak membatasi super admin walau punya site_only", () => {
    const restricted = isInvoiceSiteRestricted({
      permissions: ["invoices:site_only"],
      user: { isSuperAdmin: true },
    });

    expect(restricted).toBe(false);
  });

  it("aman terhadap daftar permission kosong", () => {
    expect(isInvoiceSiteRestricted({ permissions: [], user: {} })).toBe(false);
  });
});

describe("pemisahan permission baca dan tulis invoice", () => {
  // Regresi: INVOICE_WRITE_PERMISSIONS sempat disamakan dengan set baca, jadi
  // siapa pun yang boleh MEMBACA pelanggan juga boleh menulis ulang invoice.
  it("tidak memuat satu pun permission baca", () => {
    const readPermissions = INVOICE_WRITE_PERMISSIONS.filter((permission) =>
      permission.endsWith(":read"),
    );

    expect(readPermissions).toEqual([]);
  });

  // Halaman perpanjangan adalah satu-satunya konsumen yang menulis invoice dan
  // sudah digerbangi ensurePermission('pelanggan:update'). Kalau permission itu
  // hilang dari daftar, staf yang sah kehilangan akses.
  it("memuat pelanggan:update supaya alur perpanjangan tidak terkunci", () => {
    expect(INVOICE_WRITE_PERMISSIONS).toContain("pelanggan:update");
  });

  it("set baca tetap menerima permission baca", () => {
    expect(INVOICE_READ_PERMISSIONS).toContain("pelanggan:read");
  });
});
