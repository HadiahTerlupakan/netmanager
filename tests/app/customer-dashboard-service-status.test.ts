import { describe, expect, it } from "vitest";
import { getServiceStatusLabel } from "@/app/(customer)/dashboard/service-status";

const base = {
  connectionReady: true,
  isOnline: true,
  connectionErrorLabel: "Status perangkat belum tersedia",
  hasOutstandingInvoice: false,
};

describe("getServiceStatusLabel", () => {
  it("pelanggan isolir yang online tidak tampil sebagai aktif", () => {
    expect(
      getServiceStatusLabel({
        ...base,
        customerStatus: "ISOLIR",
        hasOutstandingInvoice: true,
      }),
    ).toEqual({ label: "Diisolir – bayar tagihan", healthy: false });
  });

  // Admin bisa mengisolir manual tanpa tunggakan; layar yang sama berkata
  // "Tagihan lunas", jadi menyuruh bayar menyesatkan.
  it("pelanggan isolir tanpa tunggakan diarahkan ke CS, bukan disuruh bayar", () => {
    expect(
      getServiceStatusLabel({ ...base, customerStatus: "ISOLIR" }),
    ).toEqual({ label: "Diisolir – hubungi admin/CS", healthy: false });
  });

  it("pelanggan nonaktif ditandai nonaktif", () => {
    expect(
      getServiceStatusLabel({ ...base, customerStatus: "NONAKTIF" }).label,
    ).toBe("Layanan nonaktif");
  });

  it("pelanggan aktif mengikuti status koneksi", () => {
    expect(getServiceStatusLabel({ ...base, customerStatus: "AKTIF" })).toEqual(
      {
        label: "Aktif & Stabil",
        healthy: true,
      },
    );
    expect(
      getServiceStatusLabel({
        ...base,
        customerStatus: "AKTIF",
        isOnline: false,
      }).label,
    ).toBe("Gangguan / Offline");
    expect(
      getServiceStatusLabel({
        ...base,
        customerStatus: "AKTIF",
        connectionReady: false,
      }).label,
    ).toBe("Status perangkat belum tersedia");
  });
});
