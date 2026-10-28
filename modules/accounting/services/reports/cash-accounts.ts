import { Prisma } from "@prisma/client";

/**
 * Akun kas: Kas, Bank, Kas Kecil, Saldo Payment Gateway, akun di bawahnya,
 * dan COA yang ditautkan rekening Kas & Bank (financial_accounts.coaId).
 * Ditentukan di sini, bukan dengan penanda di COA, agar tidak ada penanda
 * yang bisa tertinggal saat rekening baru ditautkan.
 */
export const CASH_COA_CODES = ["1-110", "1-120", "1-130", "1-140"] as const;

/** Subquery id COA kas untuk satu tenant, dipakai laporan arus kas. */
export function cashCoaIdsSql(tenantId: string) {
  return Prisma.sql`
    SELECT c.id FROM chart_of_accounts c
    LEFT JOIN chart_of_accounts parent ON parent.id = c."parentId"
    WHERE c."tenantId" = ${tenantId}
      AND (
        c.code IN (${Prisma.join([...CASH_COA_CODES])})
        OR parent.code IN (${Prisma.join([...CASH_COA_CODES])})
        OR c.id IN (
          SELECT fa."coaId" FROM financial_accounts fa
          WHERE fa."coaId" IS NOT NULL AND fa."tenantId" = ${tenantId}
        )
      )
  `;
}
