import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { ProspekRepository } from "../../repositories/ProspekRepository";
import { IklanRepository } from "../../repositories/IklanRepository";
import { cariSalesTeringan } from "./cari-sales-teringan";

const SOURCE = "RegistrationCreatedPresurveiHandler";

/**
 * Cari iklan yang kodenya cocok dengan `utm_campaign` pendaftaran.
 *
 * Mengembalikan null untuk kampanye yang tidak dikenal maupun saat pencariannya
 * gagal: atribusi adalah pelengkap, dan kehilangannya jauh lebih ringan daripada
 * kehilangan pendaftarnya.
 */
async function cariIklanDariKampanye(
  utmCampaign: unknown,
  registrationId: string,
): Promise<string | null> {
  if (typeof utmCampaign !== "string" || utmCampaign.trim().length === 0) {
    return null;
  }

  const kode = utmCampaign.trim();

  try {
    const iklan = await new IklanRepository().findByKode(kode);
    return iklan?.id ?? null;
  } catch (error) {
    logger.warn(
      `[${SOURCE}] Pendaftaran ${registrationId}: gagal mencocokkan kampanye "${kode}": ${String(error)}`,
    );
    return null;
  }
}

/**
 * Lahirkan prospek dari pendaftaran yang masuk lewat form publik.
 *
 * Idempotent lewat pemeriksaan `registrationId`: event bus menjamin
 * at-least-once, dan mengandalkan unique constraint sebagai alur normal berarti
 * log penuh error palsu serta retry yang sia-sia.
 */
export async function handleRegistrationCreatedPresurvei(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const registrationId = requirePayloadString(
    payload.registrationId,
    "registrationId",
    SOURCE,
  );
  const nama = requirePayloadString(payload.nama, "nama", SOURCE);
  const noTelp = requirePayloadString(payload.noTelp, "noTelp", SOURCE);
  const alamat = requirePayloadString(payload.alamat, "alamat", SOURCE);
  // Tanpa ini handler berjalan di system context, dan di sana ekstensi Prisma
  // tidak menyuntik filter tenant sama sekali: sales tenant lain bisa terpilih
  // sebagai pemilik, dan barisnya lahir ber-tenantId null sehingga tak pernah
  // muncul di daftar mana pun.
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);

  const repository = new ProspekRepository();

  const sudahAda = await repository.findByRegistrationId(registrationId);
  if (sudahAda) {
    logger.info(
      `[${SOURCE}] Pendaftaran ${registrationId} sudah punya prospek, dilewati`,
    );
    return;
  }

  // Pencocokan kampanye berada setelah penjaga `tenantId` dengan sengaja.
  // `findByKode` menyandarkan penyaringan tenant sepenuhnya pada ekstensi
  // Prisma, dan ekstensi hanya menyaring bila konteksnya sudah terpasang.
  // Dipindah ke atas penjaga, ia membaca kode kampanye lintas-tenant lalu
  // membuang hasilnya — berulang tiap retry, tanpa jejak.
  const iklanId = await cariIklanDariKampanye(
    payload.utmCampaign,
    registrationId,
  );
  const pemilikId = await cariSalesTeringan(tenantId);

  const prospek = await repository.create({
    nama,
    noTelp,
    alamat,
    email: (payload.email as string | null) ?? null,
    paketDiminati: (payload.paketDiminati as string | null) ?? null,
    // `sumber` menjawab "bagaimana orang ini sampai ke kita" — lewat form web,
    // dan itu tidak berubah karena ia mengklik iklan lebih dulu. Kampanye yang
    // membawanya dicatat terpisah di `iklanId`. Menggabungkan keduanya ke satu
    // kolom membuang salah satu faktanya.
    sumber: "WEBSITE",
    iklanId,
    registrationId,
    pemilikId,
  });

  logger.info(
    `[${SOURCE}] Prospek ${prospek.id} dibuat dari pendaftaran ${registrationId}`,
  );
}
