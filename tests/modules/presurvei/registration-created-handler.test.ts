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
