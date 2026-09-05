import type { TransactionClient } from "./IPlanningRepository";

/**
 * Menjalankan beberapa operasi repository sebagai satu unit atomik.
 *
 * Setiap method repository di modul ini sudah menerima parameter `tx` sejak
 * awal, tetapi tidak ada satu pun pemanggil yang pernah mengisinya — nol
 * pemakaian `$transaction` di seluruh modul. Akibatnya nyata: `applyTemplate`
 * membuat rencana, menulis audit, lalu menyalin N item BOQ satu per satu, dan
 * kegagalan di tengah meninggalkan rencana dengan anggaran total template tapi
 * item separuh. `PlanningTemplateService.update` lebih parah lagi: ia menghapus
 * seluruh item template terlebih dahulu, sehingga kegagalan di tengah
 * menghilangkan BOQ baku secara permanen tanpa jejak.
 *
 * Port ini sengaja diletakkan di domain supaya service bergantung pada
 * abstraksi, bukan langsung pada client Prisma.
 */
export interface IPlanningUnitOfWork {
  /**
   * Menjalankan `work` di dalam satu transaksi database.
   * Seluruh tulisan di dalamnya di-rollback bila `work` melempar.
   */
  runInTransaction<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
