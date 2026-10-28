import { describe, expect, it } from "vitest";

import { calculateNextDueDate } from "@/modules/finance/services/automatic-billing-payment.helpers";

/**
 * Tagihan yang dibuat lewat "Batalkan & Buat Tagihan Baru" jatuh tempo pada
 * jam pembuatannya, dan jam itu terbawa ke jatuh tempo pelanggan saat lunas:
 * tes-lab-02 mendapat 2026-11-28T01:02:01.521Z, bukan tengah malam WIB.
 */
describe("calculateNextDueDate", () => {
  const WIB_MIDNIGHT = /T17:00:00\.000Z$/;

  it("jatuh tempo baru selalu tengah malam WIB walau invoice-nya berjam", () => {
    const next = calculateNextDueDate(
      { jatuhTempo: new Date("2026-11-26T17:00:00.000Z"), tipe: "REGULER" },
      new Date("2026-10-28T01:02:01.521Z"),
    );

    expect(next.toISOString()).toBe("2026-11-27T17:00:00.000Z");
    expect(next.toISOString()).toMatch(WIB_MIDNIGHT);
  });

  it("pelanggan non-reguler juga mendapat tanggal tanpa jam", () => {
    const next = calculateNextDueDate(
      {
        jatuhTempo: new Date("2026-12-28T01:02:01.521Z"),
        tipe: "NON_REGULER",
        status: "AKTIF",
      },
      new Date("2026-10-28T01:02:01.521Z"),
    );

    expect(next.toISOString()).toMatch(WIB_MIDNIGHT);
  });
});
