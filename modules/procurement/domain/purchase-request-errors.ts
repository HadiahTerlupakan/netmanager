/** Galat bertipe pembuatan PO dari pengajuan, dipakai lintas lapisan. */

const ALREADY_ORDERED_MESSAGE =
  "Pengajuan ini sudah dibuatkan pesanan atau statusnya baru saja berubah. Muat ulang halaman, lalu coba lagi.";

const NO_ORDERABLE_REQUEST_MESSAGE =
  "Pengajuan yang dipilih tidak bisa dibuatkan PO. Hanya pengajuan yang sudah disetujui dan belum punya PO yang bisa dipilih.";

/** Pengajuan tidak punya baris barang maupun jasa yang bisa dipesan. */
export const EMPTY_REQUEST_MESSAGE =
  "Pengajuan ini tidak punya barang atau jasa yang bisa dipesan.";

/**
 * Pengajuan sudah diklaim pesanan lain atau statusnya baru saja berubah,
 * misalnya PO otomatis saat persetujuan berjalan bersamaan dengan Generate PO
 * di halaman procurement. Dilempar di dalam transaksi pembuatan PO sehingga PO
 * tidak ikut tersimpan.
 */
export class PurchaseRequestAlreadyOrderedError extends Error {
  constructor() {
    super(ALREADY_ORDERED_MESSAGE);
    this.name = "PurchaseRequestAlreadyOrderedError";
  }
}

/** Pengajuan tidak memenuhi syarat untuk dibuatkan PO. */
export class PurchaseRequestNotOrderableError extends Error {
  constructor(message: string = NO_ORDERABLE_REQUEST_MESSAGE) {
    super(message);
    this.name = "PurchaseRequestNotOrderableError";
  }
}
