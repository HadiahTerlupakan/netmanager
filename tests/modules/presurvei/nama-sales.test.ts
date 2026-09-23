import { describe, expect, it } from "vitest";
import {
  namaSalesSatuTenant,
  tentukanNamaSales,
  type IdentitasSalesBertenant,
} from "@/modules/presurvei/domain/nama-sales";

/**
 * `User.name` bertipe `String?`. Dengan `strictNullChecks: false`, compiler
 * tidak memperingatkan apa pun bila nilai null itu lolos ke layar — maka kasus
 * null diuji eksplisit di sini.
 */

describe("tentukanNamaSales", () => {
  it("memakai name bila terisi", () => {
    expect(
      tentukanNamaSales({ name: "Rina Sales", email: "rina@contoh.id" }),
    ).toBe("Rina Sales");
  });

  it("jatuh ke email saat name null", () => {
    expect(
      tentukanNamaSales({ name: null, email: "tanpa-nama@contoh.id" }),
    ).toBe("tanpa-nama@contoh.id");
  });

  it("jatuh ke email saat name kosong atau hanya spasi", () => {
    expect(tentukanNamaSales({ name: "", email: "kosong@contoh.id" })).toBe(
      "kosong@contoh.id",
    );
    expect(tentukanNamaSales({ name: "   ", email: "spasi@contoh.id" })).toBe(
      "spasi@contoh.id",
    );
  });

  it("merapikan spasi di tepi name", () => {
    expect(
      tentukanNamaSales({ name: "  Dodi  ", email: "dodi@contoh.id" }),
    ).toBe("Dodi");
  });
});

describe("namaSalesSatuTenant", () => {
  const sales = (
    ubahan: Partial<IdentitasSalesBertenant> = {},
  ): IdentitasSalesBertenant => ({
    name: "Rina Sales",
    email: "rina@contoh.id",
    tenantId: "tenant-a",
    ...ubahan,
  });

  it("mengembalikan nama saat sales satu tenant dengan baris", () => {
    expect(namaSalesSatuTenant(sales(), "tenant-a")).toBe("Rina Sales");
  });

  it("menyembunyikan nama sales dari tenant lain", () => {
    // Relasi ke-satu tidak bisa disaring di `include`; tanpa pembandingan ini
    // baris tenant A yang menunjuk sales tenant B mencetak nama orang B.
    expect(
      namaSalesSatuTenant(sales({ tenantId: "tenant-b" }), "tenant-a"),
    ).toBe(null);
  });

  it("menyembunyikan nama saat baris tak bertenant menunjuk sales bertenant", () => {
    // Bentuk persis data yang lahir dari handler pendaftaran tanpa penjaga
    // tenant: baris ber-tenantId null, pemilik dari tenant mana pun.
    expect(namaSalesSatuTenant(sales({ tenantId: "tenant-b" }), null)).toBe(
      null,
    );
  });

  it("mengembalikan null bila tidak ada sales yang terhubung", () => {
    expect(namaSalesSatuTenant(null, "tenant-a")).toBe(null);
    expect(namaSalesSatuTenant(undefined, "tenant-a")).toBe(null);
  });

  it("memakai aturan email yang sama untuk sales tanpa nama", () => {
    expect(
      namaSalesSatuTenant(
        sales({ name: null, email: "anonim@contoh.id" }),
        "tenant-a",
      ),
    ).toBe("anonim@contoh.id");
  });
});
