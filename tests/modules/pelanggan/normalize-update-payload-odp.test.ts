import { describe, expect, it } from "vitest";
import { normalizeUpdatePayload } from "@/modules/pelanggan/services/pelanggan-admin-mutation.helpers";
import type { UpdatePppByIdInput } from "@/modules/pelanggan/services/PelangganAdminMutationService";

/**
 * Jalur update pelanggan sebelumnya tidak mengenal `odpId` sama sekali — route
 * PUT tidak membacanya dari FormData, dan kontrak service tidak memuatnya.
 * Akibatnya admin memilih ODP di halaman edit, menerima "Data pelanggan
 * berhasil diperbarui", tetapi kaitan ODP-nya tidak pernah tersimpan.
 */
const baseData = (
  over: Partial<UpdatePppByIdInput["data"]> = {},
): UpdatePppByIdInput["data"] => ({
  idPelanggan: "12345678",
  nama: "Budi",
  username: "budi",
  password: "rahasia",
  hargaPaketId: "paket-1",
  tipe: null,
  tanggalAktif: "2026-09-06T00:00:00.000Z",
  jatuhTempo: "2026-10-06T00:00:00.000Z",
  status: null,
  autoIsolir: true,
  email: null,
  siteId: null,
  invoiceAction: null,
  passwordLogin: null,
  ...over,
});

describe("normalizeUpdatePayload — odpId", () => {
  it("meneruskan odpId yang dipilih admin", () => {
    const payload = normalizeUpdatePayload(
      baseData({ odpId: "odp-ODP-BLJ-01" }),
    );

    expect(payload.odpId).toBe("odp-ODP-BLJ-01");
  });

  // Select ODP mengirim string kosong untuk opsi "-- Pilih ODP --". Meneruskan
  // string kosong akan melanggar foreign key ke `mapping_nodes`.
  it("memperlakukan string kosong sebagai tanpa ODP", () => {
    expect(normalizeUpdatePayload(baseData({ odpId: "" })).odpId).toBeNull();
    expect(normalizeUpdatePayload(baseData({ odpId: "   " })).odpId).toBeNull();
  });

  it("mengembalikan null saat odpId tidak dikirim sama sekali", () => {
    expect(normalizeUpdatePayload(baseData()).odpId).toBeNull();
  });
});
