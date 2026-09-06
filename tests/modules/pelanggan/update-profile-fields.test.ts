import { describe, expect, it } from "vitest";
import { normalizeUpdatePayload } from "@/modules/pelanggan/services/pelanggan-admin-mutation.helpers";
import { updatePelangganProfileSchema } from "@/modules/pelanggan/validators/pelanggan";
import type { UpdatePppByIdInput } from "@/modules/pelanggan/services/PelangganAdminMutationService";

/**
 * PUT `/api/pelanggan-ppp/{id}` dulu membaca FormData secara manual dan hanya
 * mengenal 17 key. Field profil, koordinat, dokumen, dan seluruh rincian biaya
 * dikirim form edit tetapi dibuang diam-diam: admin mengubahnya, menerima
 * "Data pelanggan berhasil diperbarui", lalu menemukan datanya tidak berubah.
 */
const baseData = (
  over: Partial<UpdatePppByIdInput["data"]> = {},
): UpdatePppByIdInput["data"] => ({
  idPelanggan: "12345678",
  nama: "Budi",
  username: "budi",
  password: "",
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

describe("normalizeUpdatePayload — field profil", () => {
  it("meneruskan field profil dan biaya ke payload update", () => {
    const payload = normalizeUpdatePayload(
      baseData({
        profile: {
          alamat: "Jl. Merdeka 1",
          latitude: -6.2,
          longitude: 106.8,
          biayaInstalasi: 150000,
        },
      }),
    );

    expect(payload.profile).toEqual({
      alamat: "Jl. Merdeka 1",
      latitude: -6.2,
      longitude: 106.8,
      biayaInstalasi: 150000,
    });
  });

  // Field yang tidak dikirim form tidak boleh ikut ditimpa nilai kosong.
  it("menghasilkan objek kosong saat tidak ada field profil dikirim", () => {
    expect(normalizeUpdatePayload(baseData()).profile).toEqual({});
  });
});

describe("updatePelangganProfileSchema", () => {
  // `biayaInstalasi`, `biayaSewaPerangkat`, `biayaLainnya`, dan
  // `discountDuration` adalah kolom `Int?` di Prisma. Nilai pecahan lolos
  // validasi lalu ditolak Prisma, dan errornya selama ini tersamar.
  it("membulatkan nilai untuk kolom bertipe Int", () => {
    const parsed = updatePelangganProfileSchema.parse({
      biayaInstalasi: "150000.5",
      biayaSewaPerangkat: "25000.4",
      biayaLainnya: "999.6",
      discountDuration: "3.2",
    });

    expect(parsed.biayaInstalasi).toBe(150001);
    expect(parsed.biayaSewaPerangkat).toBe(25000);
    expect(parsed.biayaLainnya).toBe(1000);
    expect(parsed.discountDuration).toBe(3);
  });

  // Diskon disimpan sebagai `Float?`, jadi pecahan justru harus dipertahankan.
  it("mempertahankan pecahan untuk kolom bertipe Float", () => {
    const parsed = updatePelangganProfileSchema.parse({
      biayaInstalasiDiskon: "10.5",
      discountValue: "7.25",
    });

    expect(parsed.biayaInstalasiDiskon).toBe(10.5);
    expect(parsed.discountValue).toBe(7.25);
  });

  it("menerima boolean dalam bentuk string dari FormData", () => {
    const parsed = updatePelangganProfileSchema.parse({
      usePPN: "true",
      useDiscount: "false",
    });

    expect(parsed.usePPN).toBe(true);
    expect(parsed.useDiscount).toBe(false);
  });
});
