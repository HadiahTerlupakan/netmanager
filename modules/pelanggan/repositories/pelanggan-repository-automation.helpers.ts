import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Get customers eligible for automatic billing. */
export function findEligibleForBilling(input: EligibleBillingInput) {
  return prisma.$queryRaw<EligibleBillingCustomer[]>(
    buildEligibleBillingQuery(input),
  );
}

/**
 * Query pelanggan yang jatuh temponya masuk rentang penagihan.
 *
 * Memakai rentang tanggal, bukan pencocokan tanggal-dalam-bulan
 * (`EXTRACT(DAY FROM ...) = n`). Pencocokan lama tidak punya batas bulan/tahun,
 * jadi pelanggan dengan jatuh tempo di bulan lain bertanggal sama ikut terjaring
 * dan ditagih untuk periode yang salah; dan karena cocoknya harus persis, kohort
 * satu hari hilang permanen bila cron tidak jalan hari itu.
 */
export function buildEligibleBillingQuery(input: EligibleBillingInput) {
  const tenantFilter = input.tenantId
    ? Prisma.sql`AND p."tenantId" = ${input.tenantId}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT
      p.id, p.nama, p."jatuhTempo", p."userId", p."usePPN", p."hargaPaketId",
      p.tipe, p.status, p."tenantId",
      h.name AS "paketName", h.harga AS "paketHarga",
      h."usePPN" AS "paketUsePPN", h."ppnPercentage" AS "paketPpnPercentage"
    FROM "Pelanggan" p
    INNER JOIN "HargaPaket" h ON p."hargaPaketId" = h.id
    WHERE (p.status = 'AKTIF' OR (p.status = 'ISOLIR' AND p.tipe = 'REGULER'))
      AND p."hargaPaketId" != ''
      AND p."jatuhTempo" >= ${input.dueDateStart}
      AND p."jatuhTempo" <= ${input.dueDateEnd}
      ${tenantFilter}
    ORDER BY p.id ASC
    LIMIT ${input.batchSize} OFFSET ${input.offset}
  `;
}

type EligibleBillingInput = {
  dueDateStart: Date;
  dueDateEnd: Date;
  batchSize: number;
  offset: number;
  tenantId?: string;
};

interface EligibleBillingCustomer {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tipe: string;
  status: string;
  hargaPaketId: string;
  tenantId: string | null;
  paketName: string;
  paketHarga: number;
  paketUsePPN: boolean;
  paketPpnPercentage: number | null;
}
