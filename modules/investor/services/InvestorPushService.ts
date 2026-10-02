import { sendFCMNotification } from "@/lib/firebase/messaging";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { prismaAuth } from "@/modules/database";
import type { PesanNotifikasiInvestor } from "../domain/pesan-notifikasi-investor";
import { InvestorRepository } from "../repositories/InvestorRepository";

const AWALAN_KUNCI_DEDUPE = "investor-push:";
/** Event bus at-least-once; retry job jarang lewat dari sehari, seminggu sudah aman. */
const UMUR_KUNCI_DEDUPE_DETIK = 7 * 24 * 60 * 60;

export type AksiFcmToken = "add" | "remove";

/** Token FCM perangkat investor dan pengiriman push ke investor. */
export class InvestorPushService {
  constructor(
    private readonly investorRepository = new InvestorRepository(prismaAuth),
  ) {}

  /** Daftarkan/lepas token FCM HP investor. false bila investor tidak ada. */
  async aturToken(investorId: string, fcmToken: string, aksi: AksiFcmToken): Promise<boolean> {
    if (aksi === "remove") {
      await this.investorRepository.removeFcmToken(investorId, fcmToken);
      return true;
    }
    return this.investorRepository.addFcmToken(investorId, fcmToken);
  }

  /**
   * Kirim push ke semua HP investor. Pesan dengan `kunciUnik` yang sama tidak
   * dikirim ulang saat job event diulang. Redis mati → tetap dikirim
   * (lebih baik ganda daripada hilang).
   */
  async kirim(pesan: PesanNotifikasiInvestor): Promise<void> {
    if (await this.isSudahDikirim(pesan.kunciUnik)) {
      logger.info(`[InvestorPushService] Lewati duplikat ${pesan.kunciUnik}`);
      return;
    }
    const tokens = await this.investorRepository.findFcmTokens(pesan.investorId);
    if (tokens.length === 0) return;
    await sendFCMNotification(tokens, pesan.judul, pesan.isi, {
      url: pesan.url,
      sourceType: "INVESTOR",
      sourceId: pesan.kunciUnik,
    });
  }

  private async isSudahDikirim(kunciUnik: string): Promise<boolean> {
    try {
      const hasil = await redis.set(
        AWALAN_KUNCI_DEDUPE + kunciUnik,
        "1",
        "EX",
        UMUR_KUNCI_DEDUPE_DETIK,
        "NX",
      );
      return hasil === null;
    } catch (error) {
      logger.warn("[InvestorPushService] Dedupe Redis gagal, tetap kirim:", error);
      return false;
    }
  }
}

let investorPushService: InvestorPushService | null = null;

/** Singleton service push investor. */
export function getInvestorPushService() {
  investorPushService ??= new InvestorPushService();
  return investorPushService;
}
