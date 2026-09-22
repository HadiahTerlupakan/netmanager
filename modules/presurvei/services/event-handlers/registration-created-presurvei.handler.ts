import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { ProspekRepository } from "../../repositories/ProspekRepository";
import { cariSalesTeringan } from "./cari-sales-teringan";

const SOURCE = "RegistrationCreatedPresurveiHandler";

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

  const repository = new ProspekRepository();

  const sudahAda = await repository.findByRegistrationId(registrationId);
  if (sudahAda) {
    logger.info(
      `[${SOURCE}] Pendaftaran ${registrationId} sudah punya prospek, dilewati`,
    );
    return;
  }

  const prospek = await repository.create({
    nama,
    noTelp,
    alamat,
    email: (payload.email as string | null) ?? null,
    paketDiminati: (payload.paketDiminati as string | null) ?? null,
    sumber: "WEBSITE",
    registrationId,
    pemilikId: await cariSalesTeringan(),
  });

  logger.info(
    `[${SOURCE}] Prospek ${prospek.id} dibuat dari pendaftaran ${registrationId}`,
  );
}
