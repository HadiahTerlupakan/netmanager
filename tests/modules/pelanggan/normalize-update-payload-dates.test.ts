import { describe, expect, it } from "vitest";
import { normalizeUpdatePayload } from "@/modules/pelanggan/services/pelanggan-admin-mutation.helpers";
import type { UpdatePppByIdInput } from "@/modules/pelanggan/services/PelangganAdminMutationService";

/**
 * Regresi: menyimpan form edit memundurkan jatuh tempo sehari. Pelanggan baru
 * menyimpan "2026-11-23" sebagai tengah malam waktu server (WIB), sedangkan
 * jalur edit memakai `new Date("2026-11-23")`, yaitu tengah malam UTC, jam
 * 07.00 WIB. Di lab, mengganti paket saja sudah menggeser jatuh tempo dari
 * 23 ke 22 November dalam tampilan WIB.
 */
process.env.TZ = "Asia/Jakarta";

const baseData = (
  over: Partial<UpdatePppByIdInput["data"]> = {},
): UpdatePppByIdInput["data"] => ({
  idPelanggan: "12345678",
  nama: "Budi",
  username: "budi",
  password: "rahasia",
  hargaPaketId: "paket-1",
  tipe: null,
  tanggalAktif: "2026-10-24",
  jatuhTempo: "2026-11-23",
  status: null,
  autoIsolir: true,
  email: null,
  siteId: null,
  invoiceAction: null,
  passwordLogin: null,
  ...over,
});

describe("normalizeUpdatePayload — tanggal dari form", () => {
  it("membaca YYYY-MM-DD sebagai tengah malam lokal, sama seperti saat dibuat", () => {
    const payload = normalizeUpdatePayload(baseData());

    expect(payload.tanggalAktif.toISOString()).toBe("2026-10-23T17:00:00.000Z");
    expect(payload.jatuhTempo.toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });

  it("tetap menerima tanggal ISO lengkap", () => {
    const payload = normalizeUpdatePayload(
      baseData({ jatuhTempo: "2026-11-22T17:00:00.000Z" }),
    );

    expect(payload.jatuhTempo.toISOString()).toBe("2026-11-22T17:00:00.000Z");
  });

  it("menolak tanggal yang tidak valid", () => {
    expect(() =>
      normalizeUpdatePayload(baseData({ jatuhTempo: "bukan-tanggal" })),
    ).toThrow("Tanggal jatuh tempo tidak valid");
  });
});

describe("toDateInputValue", () => {
  it("menampilkan tanggal WIB, bukan tanggal UTC", async () => {
    const { toDateInputValue } =
      await import("@/app/admin/pelanggan/ppp/shared/date-input");

    // Tengah malam WIB 23 November disimpan sebagai 22 November 17.00 UTC.
    expect(toDateInputValue(new Date("2026-11-22T17:00:00.000Z"))).toBe(
      "2026-11-23",
    );
  });
});
