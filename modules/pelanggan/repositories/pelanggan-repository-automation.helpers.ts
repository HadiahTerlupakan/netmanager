import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Get customers eligible for automatic billing. */
export function findEligibleForBilling(input: EligibleBillingInput) {
  return prisma.$queryRaw<EligibleBillingCustomer[]>(
    buildEligibleBillingQuery(input),
  );
}

function buildEligibleBillingQuery(input: EligibleBillingInput) {
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
      AND EXTRACT(DAY FROM p."jatuhTempo") = ${input.targetDay}
      ${tenantFilter}
    ORDER BY p.id ASC
    LIMIT ${input.batchSize} OFFSET ${input.offset}
  `;
}

type EligibleBillingInput = {
  targetDay: number;
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
