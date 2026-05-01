import type { Prisma, PrismaClient } from "../repositories/prisma-boundary";
import { InventoryRepository } from "../repositories/InventoryRepository";

export class InventoryStockService {
  constructor(private readonly repository = new InventoryRepository()) {}

  /** Add stock within an existing transaction. */
  addStockInTransaction(
    tx: Prisma.TransactionClient | PrismaClient,
    input: Parameters<InventoryRepository["addStockInTransaction"]>[1],
  ) {
    return this.repository.addStockInTransaction(tx, input);
  }
}
