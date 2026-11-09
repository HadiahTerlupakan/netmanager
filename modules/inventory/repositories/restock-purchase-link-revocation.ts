import type { Prisma } from "@prisma/client";

/** Pengajuan yang link belanjanya dicabut. */
export type PurchaseLinkRevocationScope = Prisma.PurchaseRequestWhereInput;

/**
 * Cabut semua link belanja aktif milik pengajuan yang cocok dengan `scope`,
 * di dalam transaksi pemanggil. `revokedById` null berarti dicabut otomatis
 * oleh sistem (semua barang sudah dibeli, atau pengajuan/pesanan ditutup).
 */
export async function revokePurchaseLinksWithin(
  tx: Prisma.TransactionClient,
  input: {
    scope: PurchaseLinkRevocationScope;
    tenantId?: string;
    revokedById: string | null;
    now: Date;
  },
): Promise<number> {
  const result = await tx.restockPurchaseLink.updateMany({
    where: {
      revokedAt: null,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      purchaseRequest: input.scope,
    },
    data: { revokedAt: input.now, revokedById: input.revokedById },
  });
  return result.count;
}
