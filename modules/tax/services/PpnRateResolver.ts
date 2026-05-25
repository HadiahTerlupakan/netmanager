import { logger } from "@/lib/logger";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { ITaxRateConfigRepository } from "../domain/ports/ITaxRateConfigRepository";

const FALLBACK_PPN_RATE = 11;
const RATE_DRIFT_TOLERANCE = 0.001;
const PPN_RATE_CODE = "PPN";

/**
 * Resolusi rate PPN untuk billing invoice.
 *
 * Sumber kebenaran (urut prioritas):
 * 1. `TaxRateConfig` row dengan code `PPN` (single source of truth) —
 *    primary jika tenant PKP
 * 2. `paketPpnPercentage` (override per-paket) — dipakai bila tidak PKP
 * 3. `FALLBACK_PPN_RATE` (11%) — last resort bila TaxRateConfig kosong
 *    (misal tenant baru sebelum seed)
 *
 * Memberi warning kalau rate paket drift dari sumber otoritatif agar tidak
 * terjadi mismatch antara invoice yang dikirim ke pelanggan vs jumlah yang
 * dilaporkan ke DJP.
 */
export class PpnRateResolver {
  constructor(
    private readonly configRepo: ITaxConfigRepository,
    private readonly rateConfigRepo: ITaxRateConfigRepository,
  ) {}

  async resolve(
    tenantId: string,
    paketPpnPercentage: number | null,
  ): Promise<number> {
    const config = await this.configRepo.findByTenantId(tenantId);

    if (config?.isPkp) {
      const authoritativeRate = await this.getAuthoritativeRate(tenantId);
      if (
        paketPpnPercentage !== null &&
        Math.abs(paketPpnPercentage - authoritativeRate) > RATE_DRIFT_TOLERANCE
      ) {
        logger.warn(
          `[PpnRateResolver] Rate paket (${paketPpnPercentage}%) berbeda dari TaxRateConfig PPN (${authoritativeRate}%) untuk tenant ${tenantId}. Memakai rate otoritatif.`,
        );
      }
      return authoritativeRate;
    }

    return paketPpnPercentage ?? FALLBACK_PPN_RATE;
  }

  /**
   * Resolve dari TaxRateConfig PPN. Fallback ke `FALLBACK_PPN_RATE`
   * (11%, standar Indonesia) hanya bila row TaxRateConfig PPN tidak ada
   * — situasi ini seharusnya tidak terjadi karena seed default sudah
   * include PPN.
   */
  private async getAuthoritativeRate(tenantId: string): Promise<number> {
    try {
      const rateConfig = await this.rateConfigRepo.findByCode(
        tenantId,
        PPN_RATE_CODE,
      );
      if (rateConfig && rateConfig.isActive) {
        return rateConfig.rate;
      }
      logger.warn(
        `[PpnRateResolver] TaxRateConfig PPN tidak ada / inactive untuk tenant ${tenantId}. Pakai FALLBACK_PPN_RATE.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[PpnRateResolver] Gagal baca TaxRateConfig PPN untuk tenant ${tenantId}: ${message}. Pakai FALLBACK_PPN_RATE.`,
      );
    }
    return FALLBACK_PPN_RATE;
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
