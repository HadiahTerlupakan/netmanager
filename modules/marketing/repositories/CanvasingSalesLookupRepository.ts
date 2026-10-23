import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

/**
 * Digit akhir nomor HP yang dibandingkan. Mengabaikan awalan 0 / 62 / +62 dan
 * pemisah, sehingga "0812-3456-7890" cocok dengan "+62 812 3456 7890".
 */
const DIGIT_AKHIR_TELEPON = 9;
const STATUS_CANVASING_DISETUJUI = "APPROVED";

/** Hanya digit, dipotong ke `DIGIT_AKHIR_TELEPON` digit terakhir; null bila terlalu pendek. */
export function kunciTelepon(noTelp: string): string | null {
  const digit = noTelp.replace(/\D/g, "");
  return digit.length < DIGIT_AKHIR_TELEPON ? null : digit.slice(-DIGIT_AKHIR_TELEPON);
}

/**
 * Pencarian sales dari data canvasing (milik modul marketing) untuk modul lain,
 * mis. menentukan sales penanggung jawab pelanggan. tenantId disaring eksplisit.
 */
export class CanvasingSalesLookupRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Id sales berbeda dari canvasing APPROVED tenant dengan nomor HP yang sama. */
  async cariSalesDariTelepon(tenantId: string, noTelp: string): Promise<string[]> {
    const kunci = kunciTelepon(noTelp);
    if (!kunci) return [];
    const baris = await this.client.$queryRaw<{ salesId: string }[]>`
      SELECT DISTINCT "salesId"
      FROM canvasing
      WHERE "tenantId" = ${tenantId}
        AND status = ${STATUS_CANVASING_DISETUJUI}::"CanvasingStatus"
        AND "salesId" IS NOT NULL
        AND right(regexp_replace("noTelpon", '\\D', '', 'g'), ${DIGIT_AKHIR_TELEPON}) = ${kunci}
    `;
    return baris.map((item) => item.salesId);
  }
}
