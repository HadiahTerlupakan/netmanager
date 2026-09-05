import { prisma } from "@/lib/prisma";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type { TransactionClient } from "../domain/ports/IPlanningRepository";

/** Implementasi {@link IPlanningUnitOfWork} di atas Prisma. */
export class PrismaPlanningUnitOfWork implements IPlanningUnitOfWork {
  async runInTransaction<T>(
    work: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction((tx) => work(tx as TransactionClient));
  }
}
