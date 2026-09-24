import { describe, expect, it } from "vitest";

import { teksPeranPelaku } from "@/app/admin/presurvei/labelPeranPelaku";

/**
 * Label peran pelaku di tabel, rincian, dan dashboard.
 *
 * Ditulis literal: "Non-sales", bukan "Teknisi" — admin yang mencatat telepon
 * dari web juga non-sales. Departemen menyusul di belakang supaya teknisi
 * tetap terbaca.
 */
describe("teksPeranPelaku", () => {
  it("peran beserta departemen", () => {
    expect(
      teksPeranPelaku({ peranPelaku: "NON_SALES", departemenPelaku: "Teknik" }),
    ).toBe("Non-sales · Teknik");
    expect(
      teksPeranPelaku({ peranPelaku: "SALES", departemenPelaku: "Marketing" }),
    ).toBe("Sales · Marketing");
  });

  it("peran saja bila pelaku tanpa departemen", () => {
    expect(
      teksPeranPelaku({ peranPelaku: "SALES", departemenPelaku: null }),
    ).toBe("Sales");
  });

  it("null bila peran dan departemen tidak diketahui", () => {
    expect(
      teksPeranPelaku({ peranPelaku: null, departemenPelaku: null }),
    ).toBeNull();
  });

  it("departemen kosong tidak meninggalkan pemisah menggantung", () => {
    expect(
      teksPeranPelaku({ peranPelaku: "NON_SALES", departemenPelaku: "" }),
    ).toBe("Non-sales");
  });
});
