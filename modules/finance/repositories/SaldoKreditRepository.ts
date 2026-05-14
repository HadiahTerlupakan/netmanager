import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import { getTenantIdFromContext } from "@/lib/tenant-context";

/** Atomic consume saldo kredit with SELECT FOR UPDATE and tenant isolation. */
export async function consumeSaldoKreditAtomic(
  pelangganId: string,
  capAmount: bigint,
): Promise<bigint> {
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const tenantFilter =
    !isSuperAdmin && tenantId
      ? Prisma.sql`AND "tenantId" = ${tenantId}`
      : Prisma.empty;

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ saldoKreditRupiah: bigint }>>`
      SELECT "saldoKreditRupiah" FROM "Pelanggan"
      WHERE id = ${pelangganId} ${tenantFilter}
      FOR UPDATE
    `;
    const saldo = rows[0]?.saldoKreditRupiah ?? 0n;
    if (saldo <= 0n) return 0n;

    const apply = saldo > capAmount ? capAmount : saldo;
    await tx.pelanggan.update({
      where: { id: pelangganId },
      data: { saldoKreditRupiah: { decrement: apply } },
    });
    return apply;
  });
}
