import type { Job } from "bullmq";

import type { EventJobData } from "@/lib/event-bus/queues";
import { susunPesanInvestor } from "../../domain/pesan-notifikasi-investor";
import { getInvestorPushService } from "../InvestorPushService";

/**
 * Kirim push ke investor untuk event modal diterima/ditolak, bagi hasil
 * disetujui, dan uang dikirim. Idempotent lewat `kunciUnik` per entitas.
 */
export async function handleInvestorNotification(job: Job<EventJobData>): Promise<void> {
  const pesan = susunPesanInvestor(job.data.eventName, job.data.payload);
  if (!pesan) return;
  await getInvestorPushService().kirim(pesan);
}
