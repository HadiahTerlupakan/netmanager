import { describe, expect, it, vi } from "vitest";

import { CustomerPortalService } from "@/modules/pelanggan/services/CustomerPortalService";

const customer = {
  id: "cust-1",
  idPelanggan: "PLG-001",
  nama: "Budi",
  username: "budi",
  email: null as string | null,
  noTelp: "0812",
  alamat: null as string | null,
  status: "AKTIF",
  tipe: "RESIDENTIAL",
  tanggalAktif: new Date("2026-01-01T00:00:00Z"),
  jatuhTempo: new Date("2026-11-10T17:00:00Z"),
  provinsi: null as string | null,
  kabupatenKota: null as string | null,
  kecamatan: null as string | null,
  kelurahanDesa: null as string | null,
  hargaPaket: null as null,
};

describe("CustomerPortalService.getProfile", () => {
  // Kelebihan bayar dikreditkan ke saldo, tetapi pelanggan tidak pernah
  // melihat berapa saldonya.
  it("profil membawa saldo kredit pelanggan", async () => {
    const service = new CustomerPortalService(
      { findByIdWithPackage: vi.fn().mockResolvedValue(customer) } as never,
      { getSaldoKredit: vi.fn().mockResolvedValue(25000) } as never,
    );

    await expect(service.getProfile("cust-1")).resolves.toMatchObject({
      id: "cust-1",
      saldoKredit: 25000,
    });
  });
});
