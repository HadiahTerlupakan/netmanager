import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

/**
 * Event bus memberi jaminan at-least-once, jadi satu pendaftaran bisa sampai
 * dua kali. Tanpa pemeriksaan di depan, percobaan kedua menabrak unique
 * constraint `registrationId` — log penuh error palsu dan BullMQ me-retry
 * sesuatu yang sebenarnya sudah berhasil.
 */

// vi.mock di bawah ini di-hoist ke atas file oleh Vitest, sebelum deklarasi
// `const` biasa sempat jalan. Referensi lewat objek `mocks` (dibungkus
// vi.hoisted) supaya factory tidak menabrak temporal dead zone — pola yang
// sama dipakai tests/notification-create-propagates-tenant-context.test.ts.
const mocks = vi.hoisted(() => ({
  buatProspek: vi.fn(),
  cariByRegistrationId: vi.fn(),
  cariSalesTeringan: vi.fn(),
}));
const { buatProspek, cariByRegistrationId, cariSalesTeringan } = mocks;

vi.mock("@/modules/presurvei/repositories/ProspekRepository", () => ({
  ProspekRepository: class {
    create = mocks.buatProspek;
    findByRegistrationId = mocks.cariByRegistrationId;
  },
}));

vi.mock(
  "@/modules/presurvei/services/event-handlers/cari-sales-teringan",
  () => ({ cariSalesTeringan: mocks.cariSalesTeringan }),
);

const cariIklanByKode = vi.fn();

vi.mock("@/modules/presurvei/repositories/IklanRepository", () => ({
  IklanRepository: class {
    findByKode = cariIklanByKode;
  },
}));

import { handleRegistrationCreatedPresurvei } from "@/modules/presurvei/services/event-handlers/registration-created-presurvei.handler";

const job = (payload: Record<string, unknown>): Job<never> =>
  ({ data: { payload } }) as never;

const payloadLengkap = {
  registrationId: "reg-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: "budi@contoh.id",
  alamat: "Jl. Merdeka 10",
  paketDiminati: "20 Mbps",
  utmSource: "instagram",
  utmMedium: "cpc",
  utmCampaign: "promo-ramadan",
  tenantId: "tenant-1",
};

describe("handleRegistrationCreatedPresurvei", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cariByRegistrationId.mockResolvedValue(null);
    cariSalesTeringan.mockResolvedValue("sales-1");
    buatProspek.mockResolvedValue({ id: "prospek-1" });
    cariIklanByKode.mockResolvedValue(null);
  });

  it("melahirkan prospek bersumber WEBSITE dari pendaftaran", async () => {
    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({
        nama: "Budi",
        noTelp: "081234567890",
        email: "budi@contoh.id",
        alamat: "Jl. Merdeka 10",
        paketDiminati: "20 Mbps",
        sumber: "WEBSITE",
        registrationId: "reg-1",
        pemilikId: "sales-1",
      }),
    );
  });

  it("tidak membuat prospek kedua saat event sampai dua kali", async () => {
    cariByRegistrationId.mockResolvedValue({ id: "prospek-lama" });

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).not.toHaveBeenCalled();
  });

  it("membuat prospek tanpa pemilik saat tidak ada sales aktif", async () => {
    cariSalesTeringan.mockResolvedValue(null);

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: null }),
    );
  });

  it("menolak payload tanpa registrationId", async () => {
    const { registrationId: _dibuang, ...tanpaId } = payloadLengkap;

    await expect(
      handleRegistrationCreatedPresurvei(job(tanpaId)),
    ).rejects.toThrow();

    expect(buatProspek).not.toHaveBeenCalled();
  });

  it("menolak payload tanpa nomor telepon", async () => {
    // Prospek tanpa nomor telepon tidak bisa di-follow-up sama sekali.
    const { noTelp: _dibuang, ...tanpaTelp } = payloadLengkap;

    await expect(
      handleRegistrationCreatedPresurvei(job(tanpaTelp)),
    ).rejects.toThrow();
  });

  it("menolak payload tanpa tenantId dan tidak menyentuh apa pun", async () => {
    // Tanpa tenantId, worker menjalankan handler di system context dan ekstensi
    // Prisma berhenti memfilter: sales tenant lain bisa terpilih dan barisnya
    // lahir yatim. Lebih baik gagal berisik.
    const { tenantId: _dibuang, ...tanpaTenant } = payloadLengkap;

    await expect(
      handleRegistrationCreatedPresurvei(job(tanpaTenant)),
    ).rejects.toThrow();

    expect(cariSalesTeringan).not.toHaveBeenCalled();
    expect(buatProspek).not.toHaveBeenCalled();
  });

  it("meneruskan tenantId ke pencarian sales", async () => {
    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(cariSalesTeringan).toHaveBeenCalledWith("tenant-1");
  });
});

describe("handleRegistrationCreatedPresurvei — atribusi iklan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cariByRegistrationId.mockResolvedValue(null);
    cariSalesTeringan.mockResolvedValue("sales-1");
    buatProspek.mockResolvedValue({ id: "prospek-1" });
    cariIklanByKode.mockResolvedValue(null);
  });

  it("menautkan prospek ke iklan yang kodenya cocok dengan utm_campaign", async () => {
    cariIklanByKode.mockResolvedValue({ id: "iklan-1", isAktif: true });

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(cariIklanByKode).toHaveBeenCalledWith("promo-ramadan");
    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: "iklan-1", sumber: "IKLAN" }),
    );
  });

  it("tetap bersumber WEBSITE saat kampanyenya tidak dikenal", async () => {
    // UTM dari tautan lama atau salah ketik tidak boleh membuat prospek hilang —
    // ia tetap tercatat, hanya tanpa atribusi kampanye.
    cariIklanByKode.mockResolvedValue(null);

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: null, sumber: "WEBSITE" }),
    );
  });

  it("tidak mencari iklan saat pendaftaran datang tanpa utm_campaign", async () => {
    const { utmCampaign: _dibuang, ...tanpaKampanye } = payloadLengkap;

    await handleRegistrationCreatedPresurvei(job(tanpaKampanye));

    expect(cariIklanByKode).not.toHaveBeenCalled();
    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: null, sumber: "WEBSITE" }),
    );
  });

  it("tidak jatuh saat pencarian iklan gagal", async () => {
    // Atribusi adalah pelengkap; kegagalannya tidak boleh menelan pendaftaran.
    cariIklanByKode.mockRejectedValue(new Error("database sibuk"));

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: null, sumber: "WEBSITE" }),
    );
  });
});
