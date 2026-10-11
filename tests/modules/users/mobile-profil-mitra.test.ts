import { beforeEach, describe, expect, it } from "vitest";
import { prismaMock } from "../../setup";
import {
  getMobileProfileForRoute,
  updateMobileProfileForRoute,
} from "@/modules/users/services/MobileProfileRouteService";

const SESI_MITRA = {
  id: "cmov3i5qz0000r0n93w8hjo42",
  role: "MITRA",
  tenantId: "tenant-1",
};

const BARIS_MITRA = {
  id: SESI_MITRA.id,
  name: "Budi Mitra Teknisi",
  email: "mitrateknisi@example.com",
  phone: "081234567891",
  isActive: true,
  mitraType: "MITRA_TEKNISI",
  nik: null as string | null,
  fotoDiri: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  siteId: "site-hq",
  requiresFaceVerification: false,
};

const SITE_HQ = { id: "site-hq", name: "Headquarters" };

describe("profil mobile mitra", () => {
  beforeEach(() => {
    prismaMock.mitra.findFirst.mockResolvedValue(BARIS_MITRA);
    prismaMock.sites.findFirst.mockResolvedValue(SITE_HQ);
  });

  it("mengirim site sebagai objek, sebentuk dengan profil karyawan", async () => {
    // Aplikasi membaca `sites.name`; array membuatnya selalu "Belum diatur".
    const profil = await getMobileProfileForRoute(SESI_MITRA);

    expect(profil?.sites).toEqual(SITE_HQ);
  });

  it("menyimpan perubahan profil mitra ke tabel mitra, bukan User", async () => {
    prismaMock.mitra.update.mockResolvedValue({
      ...BARIS_MITRA,
      phone: "081299990001",
    });

    const hasil = await updateMobileProfileForRoute({
      user: SESI_MITRA,
      input: { phone: "081299990001" },
    });

    // Id mitra tidak ada di tabel `User`; lewat `prisma.user.update` baris
    // tidak ditemukan dan PATCH profil mitra berakhir 500.
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.mitra.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESI_MITRA.id },
        data: { phone: "081299990001" },
      }),
    );
    expect(hasil).toMatchObject({ phone: "081299990001" });
  });

  it("menolak menyimpan bila mitra bukan milik tenant sesi", async () => {
    prismaMock.mitra.findFirst.mockResolvedValue(null);

    await expect(
      updateMobileProfileForRoute({
        user: SESI_MITRA,
        input: { name: "Nama Baru" },
      }),
    ).rejects.toThrow(/Mitra tidak ditemukan/);
    expect(prismaMock.mitra.update).not.toHaveBeenCalled();
  });
});
