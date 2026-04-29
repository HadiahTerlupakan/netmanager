import { Prisma } from "@prisma/client";

type PrismaClientLike = Prisma.TransactionClient;

export class InventoryTransactionVerificationRepository {
  constructor(private readonly db: PrismaClientLike) {}

  /** Verifikasi transaksi upload foto inventory. */
  async verifyInventoryTransaction(input: {
    transactionId: string;
    transactionType: string;
  }) {
    if (input.transactionType === "inventory-masuk") {
      return this.db.barangMasuk.findUnique({
        where: { id: input.transactionId },
        select: { id: true, barangId: true, gudangId: true },
      });
    }
    if (input.transactionType === "inventory-keluar") {
      return this.db.barangKeluar.findUnique({
        where: { id: input.transactionId },
        select: { id: true, barangId: true, gudangId: true },
      });
    }
    if (input.transactionType === "inventory-transfer") {
      return this.db.transferAntarGudang.findUnique({
        where: { id: input.transactionId },
        select: { id: true, barangId: true },
      });
    }
    return { id: input.transactionId };
  }
}
