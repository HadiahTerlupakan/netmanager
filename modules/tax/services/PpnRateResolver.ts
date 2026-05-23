import { logger } from "@/lib/logger";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";

const FALLBACK_PPN_RATE = 11;
const RATE_DRIFT_TOLERANCE = 0.001;

/**
 * Resolusi rate PPN untuk billing invoice.
 *
 * Sumber kebenaran:
 * 1. `TaxConfig.ppnRate` (lapor DJP) — primary jika tenant PKP
 * 2. `paketPpnPercentage` (override per-paket) — dipakai jika TaxConfig tidak ada
 * 3. `FALLBACK_PPN_RATE` (11%) — last resort
 *
 * Memberi warning kalau rate paket drift dari TaxConfig agar tidak terjadi
 * mismatch antara invoice yang dikirim ke pelanggan vs jumlah yang dilaporkan
 * ke DJP.
 */
export class PpnRateResolver {
  constructor(private readonly configRepo: ITaxConfigRepository) {}

  async resolve(
    tenantId: string,
    paketPpnPercentage: number | null,
  ): Promise<number> {
    const config = await this.configRepo.findByTenantId(tenantId);

    if (config?.isPkp) {
      const taxConfigRate = Number(config.ppnRate);
      if (
        paketPpnPercentage !== null &&
        Math.abs(paketPpnPercentage - taxConfigRate) > RATE_DRIFT_TOLERANCE
      ) {
        logger.warn(
          `[PpnRateResolver] Rate paket (${paketPpnPercentage}%) berbeda dari TaxConfig PKP (${taxConfigRate}%) untuk tenant ${tenantId}. Memakai rate TaxConfig.`,
        );
      }
      return taxConfigRate;
    }

    return paketPpnPercentage ?? FALLBACK_PPN_RATE;
  }

  /**
   * Versi `resolve` yang menerima tenantId nullable. Digunakan untuk
   * pelanggan legacy / lintas-tenant yang tidak terikat ke TaxConfig.
   * Fallback ke rate paket atau `FALLBACK_PPN_RATE`.
   */
  async resolveOptional(
    tenantId: string | null | undefined,
    paketPpnPercentage: number | null,
  ): Promise<number> {
    if (tenantId) {
      return this.resolve(tenantId, paketPpnPercentage);
    }
    return paketPpnPercentage ?? FALLBACK_PPN_RATE;
  }
}
