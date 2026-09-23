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
 *
 * Cadangan untuk nama kosong sengaja BUKAN email: pemegang permission
 * presurvei belum tentu berhak melihat email rekannya. Label cadangan ditulis
 * ulang sebagai literal, bukan dirakit dari konstanta produksi.
 */

describe("tentukanNamaSales", () => {
  it("memakai name bila terisi", () => {
    expect(
      tentukanNamaSales({ id: "clsales0000rina01", name: "Rina Sales" }),
    ).toBe("Rina Sales");
  });

  it("memakai label netral berpotongan ujung id saat name null", () => {
    expect(tentukanNamaSales({ id: "clxyz0000abc123", name: null })).toBe(
      "Tanpa nama (…abc123)",
    );
  });

  it("memakai label netral yang sama saat name kosong atau hanya spasi", () => {
    expect(tentukanNamaSales({ id: "clxyz0000kosong", name: "" })).toBe(
      "Tanpa nama (…kosong)",
    );
    expect(tentukanNamaSales({ id: "clxyz0000spasi9", name: "   " })).toBe(
      "Tanpa nama (…spasi9)",
    );
  });

  it("membedakan dua sales tanpa nama yang id-nya berawalan sama", () => {
    // cuid diawali cap waktu: dua user yang dibuat berdekatan berbagi awalan.
    // Potongan AWAL id akan membuat keduanya kembar di dropdown.
    const pertama = tentukanNamaSales({ id: "clmsama000aaa111", name: null });
    const kedua = tentukanNamaSales({ id: "clmsama000bbb222", name: null });

    expect(pertama).not.toBe(kedua);
  });

  it("tidak memakai email walau objek masukan kebetulan membawanya", () => {
    // Baris Prisma yang diteruskan apa adanya bisa membawa kolom lebih. Label
    // tidak boleh jatuh ke email dalam keadaan apa pun.
    const hasil = tentukanNamaSales({
      id: "clxyz0000anonim",
      name: null,
      email: "anonim@contoh.id",
    } as never);

    expect(hasil).not.toContain("anonim@contoh.id");
    expect(hasil).toBe("Tanpa nama (…anonim)");
  });

  it("merapikan spasi di tepi name", () => {
    expect(tentukanNamaSales({ id: "clxyz0000dodi01", name: "  Dodi  " })).toBe(
      "Dodi",
    );
  });
});

describe("namaSalesSatuTenant", () => {
  const sales = (
    ubahan: Partial<IdentitasSalesBertenant> = {},
  ): IdentitasSalesBertenant => ({
    id: "clxyz0000rina01",
    name: "Rina Sales",
    tenantId: "tenant-a",
    ...ubahan,
  });

  it("mengembalikan nama saat sales satu tenant dengan baris", () => {
    expect(namaSalesSatuTenant(sales(), "tenant-a")).toBe("Rina Sales");
  });

  it("menyembunyikan nama sales dari tenant lain", () => {
    // Penjaga per baris: baris tenant A yang menunjuk sales tenant B tidak
    // boleh mencetak nama orang B.
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

  it("memakai label netral yang sama untuk sales tanpa nama", () => {
    expect(
      namaSalesSatuTenant(
        sales({ id: "clxyz0000anon77", name: null }),
        "tenant-a",
      ),
    ).toBe("Tanpa nama (…anon77)");
  });
});
