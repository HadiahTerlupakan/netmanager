import type { IPlanningUnitOfWork } from "@/modules/planning/domain/ports/IPlanningUnitOfWork";
import type { TransactionClient } from "@/modules/planning/domain/ports/IPlanningRepository";

/**
 * Unit of work tiruan untuk unit test service planning.
 *
 * Seluruh service planning kini membungkus tulisan-tulisannya dalam
 * `runInTransaction`. Di unit test tidak ada database, jadi fake ini hanya
 * menjalankan callback-nya apa adanya: perilaku service tetap teruji, sementara
 * rollback yang sesungguhnya diuji di tingkat integrasi.
 *
 * `tx` sengaja `undefined` — repository tiruan tidak memakainya, dan dengan
 * begitu assertion argumen repository tidak perlu memedulikan nilai transaksi.
 */
export function createFakeUnitOfWork(): IPlanningUnitOfWork {
  return {
    runInTransaction: <T>(work: (tx: TransactionClient) => Promise<T>) =>
      work(undefined),
  };
}
