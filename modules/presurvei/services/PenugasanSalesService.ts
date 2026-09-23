import { AppError } from "@/lib/errors";
import {
  isCalonSalesSah,
  type SyaratPenugasan,
} from "../domain/penugasan-sales";
import type { ISalesRepository } from "../domain/ports/ISalesRepository";
import { SalesRepository } from "../repositories/SalesRepository";

/**
 * Pesan penolakan tunggal. "Bukan sales", "tenant lain", "nonaktif", dan
 * "tidak ada" sengaja tidak dibedakan: pesan yang berbeda memberi tahu
 * pemanggil bahwa sebuah id milik user tenant lain.
 */
const PESAN_SALES_TIDAK_SAH = "Sales tidak ditemukan di tenant ini";
const KODE_SALES_TIDAK_SAH = "SALES_TIDAK_SAH";
const STATUS_HTTP_TIDAK_DAPAT_DIPROSES = 422;

/**
 * Validasi integritas "sales se-tenant" untuk baris presurvei yang menunjuk
 * seorang sales — target dan pemilik prospek.
 *
 * Ini bukan otorisasi: siapa yang boleh menugaskan tetap diputuskan route
 * (`app/api/presurvei/akses-presurvei.ts`) dan gerbang permission. Yang
 * dijaga di sini adalah bahwa baris tenant A tidak menunjuk user tenant B.
 */
export class PenugasanSalesService {
  constructor(
    private readonly salesRepository: ISalesRepository = new SalesRepository(),
  ) {}

  /**
   * Tenant tempat baris baru ditulis: tenant sesi, atau — hanya bila sesi tak
   * bertenant (super admin) — tenant milik sales itu sendiri. Null bila tak
   * dapat ditentukan; `pastikanSah` lalu menolaknya.
   */
  async tentukanTenantBaris(
    userId: string,
    tenantSesi: string | null,
  ): Promise<string | null> {
    if (tenantSesi) return tenantSesi;
    const calon = await this.salesRepository.cariCalonSales(userId);
    return calon?.tenantId ?? null;
  }

  /** Lempar 422 generik bila `userId` bukan sales sah di `tenantBaris`. */
  async pastikanSah(
    userId: string,
    tenantBaris: string | null,
    syarat: SyaratPenugasan,
  ): Promise<void> {
    const calon = await this.salesRepository.cariCalonSales(userId);
    if (isCalonSalesSah(calon, tenantBaris, syarat)) return;

    throw new AppError(
      PESAN_SALES_TIDAK_SAH,
      STATUS_HTTP_TIDAK_DAPAT_DIPROSES,
      KODE_SALES_TIDAK_SAH,
    );
  }
}
