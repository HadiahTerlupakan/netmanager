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
    ).toEqual({ label: "Diisolir – bayar tagihan", tone: "error" });
  });

  // Admin bisa mengisolir manual tanpa tunggakan; layar yang sama berkata
  // "Tagihan lunas", jadi menyuruh bayar menyesatkan.
  it("pelanggan isolir tanpa tunggakan diarahkan ke CS, bukan disuruh bayar", () => {
    expect(
      getServiceStatusLabel({ ...base, customerStatus: "ISOLIR" }),
    ).toEqual({ label: "Diisolir – hubungi admin/CS", tone: "error" });
  });

  it("pelanggan nonaktif ditandai nonaktif", () => {
    expect(
      getServiceStatusLabel({ ...base, customerStatus: "NONAKTIF" }).label,
    ).toBe("Layanan nonaktif");
  });

  // Sesi PPPoE pelanggan maintenance bisa tetap online; dulu ia tampil hijau
  // "Aktif & Stabil" padahal teknisi sedang menangani layanannya. Teks sama
  // persis dengan aplikasi mobile.
  it("pelanggan maintenance yang online tampil dalam perbaikan, bukan aktif", () => {
    expect(
      getServiceStatusLabel({ ...base, customerStatus: "MAINTENANCE" }),
    ).toEqual({ label: "Dalam perbaikan teknisi", tone: "warning" });
  });

  // Sesi pelanggan dismantle baru putus beberapa saat setelah statusnya
  // berubah; selama itu ia dulu tampil "Aktif & Stabil".
  it("pelanggan dismantle yang sesinya belum putus tampil berhenti berlangganan", () => {
    expect(
      getServiceStatusLabel({ ...base, customerStatus: "DISMANTLE" }),
    ).toEqual({ label: "Berhenti berlangganan", tone: "error" });
  });

  it("pelanggan aktif mengikuti status koneksi", () => {
    expect(getServiceStatusLabel({ ...base, customerStatus: "AKTIF" })).toEqual(
      {
        label: "Aktif & Stabil",
        tone: "ok",
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
