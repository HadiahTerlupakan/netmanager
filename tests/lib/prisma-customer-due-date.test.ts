import { describe, expect, it } from "vitest";

import { normalizeCustomerDueDateData } from "@/lib/prisma-customer-due-date";

const TZ = "Asia/Jakarta";

/**
 * Jatuh tempo pelanggan pernah tersimpan dengan jam pembuatan invoice
 * (2026-11-28T01:02:01.521Z). Setiap penulisan kini dibulatkan ke awal hari
 * WIB, apa pun jalur penulisnya.
 */
describe("normalizeCustomerDueDateData", () => {
  it("membulatkan jatuh tempo berjam ke tengah malam WIB di hari yang sama", () => {
    const data = { jatuhTempo: new Date("2026-11-28T01:02:01.521Z") };

    normalizeCustomerDueDateData(data, TZ);

    expect(data.jatuhTempo).toEqual(new Date("2026-11-27T17:00:00.000Z"));
  });

  it("tanggal dari form admin tetap di hari yang dipilih", () => {
    const data = { jatuhTempo: "2026-11-27T00:00:00+07:00" };

    normalizeCustomerDueDateData(data, TZ);

    expect(data.jatuhTempo).toEqual(new Date("2026-11-26T17:00:00.000Z"));
  });

  it("bentuk { set }, createMany, dan data tanpa jatuh tempo", () => {
    const update = { jatuhTempo: { set: new Date("2026-12-01T05:00:00Z") } };
    const many = [
      { jatuhTempo: new Date("2026-12-01T05:00:00Z") },
      { nama: "tanpa jatuh tempo" },
    ];

    normalizeCustomerDueDateData(update, TZ);
    normalizeCustomerDueDateData(many, TZ);

    expect(update.jatuhTempo.set).toEqual(new Date("2026-11-30T17:00:00.000Z"));
    expect(many[0]).toEqual({
      jatuhTempo: new Date("2026-11-30T17:00:00.000Z"),
    });
    expect(many[1]).toEqual({ nama: "tanpa jatuh tempo" });
  });
});
