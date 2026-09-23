import { AppError } from "@/lib/errors";
import {
  isCalonSalesSah,
  type CalonSales,
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

/** Calon sales yang sudah dimuat beserta tenant baris yang dituju. */
export interface PenugasanSales {
  calon: CalonSales | null;
  tenantBaris: string | null;
}

/**
 * Validasi integritas "sales se-tenant" untuk baris presurvei yang menunjuk
 * seorang sales — target dan pemilik prospek.
 *
 * Ini bukan otorisasi: siapa yang boleh menugaskan tetap diputuskan route
 * (`app/api/presurvei/akses-presurvei.ts`) dan gerbang permission. Yang
 * dijaga di sini adalah bahwa baris tenant A tidak menunjuk user tenant B.
 *
 * Pemuatan dan pemeriksaan dipisah supaya user hanya dibaca sekali, walau
 * pemanggil (target) perlu tenant baris dulu untuk memutuskan syaratnya.
 */
export class PenugasanSalesService {
  constructor(
    private readonly salesRepository: ISalesRepository = new SalesRepository(),
  ) {}

  /**
   * Muat calon untuk baris BARU: tenant baris = tenant sesi, atau — hanya
   * bila sesi tak bertenant (super admin) — tenant milik sales itu sendiri.
   */
  async muatUntukBarisBaru(
    userId: string,
    tenantSesi: string | null,
  ): Promise<PenugasanSales> {
    const calon = await this.salesRepository.cariCalonSales(userId);
    // `||`, bukan `??`: tenant sesi "" bukan tenant, sama seperti null.
    return { calon, tenantBaris: tenantSesi || (calon?.tenantId ?? null) };
  }

  /**
   * Muat calon untuk baris yang tenantnya sudah pasti (prospek yang ada).
   * Tenant baris kosong TIDAK jatuh ke tenant sales — `pastikanSah` menolaknya.
   */
  async muatUntukBaris(
    userId: string,
    tenantBaris: string | null,
  ): Promise<PenugasanSales> {
    const calon = await this.salesRepository.cariCalonSales(userId);
    return { calon, tenantBaris };
  }

  /** Tenant baris yang sah, atau lempar 422 generik bila calon tidak sah. */
  pastikanSah(penugasan: PenugasanSales, syarat: SyaratPenugasan): string {
    if (isCalonSalesSah(penugasan.calon, penugasan.tenantBaris, syarat)) {
      return penugasan.tenantBaris;
    }

    throw new AppError(
      PESAN_SALES_TIDAK_SAH,
      STATUS_HTTP_TIDAK_DAPAT_DIPROSES,
      KODE_SALES_TIDAK_SAH,
    );
  }
}
