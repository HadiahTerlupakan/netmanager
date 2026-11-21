/** Galat bertipe pencatatan barang masuk (GRN) yang dipakai lintas lapisan. */

/** Pesan untuk petugas saat pesanan restock diterima dari halaman Pembelian. */
export const RESTOCK_ORDER_RECEIPT_MESSAGE =
  "Pesanan ini dari pengajuan restock. Masukkan barangnya lewat tombol Masukkan Barang di halaman Restock.";

/**
 * Jumlah masuk melebihi sisa pesanan (dipesan dikurangi yang tidak jadi
 * datang dan yang sudah masuk), biasanya karena pesanan baru saja berubah.
 * Dilempar di dalam transaksi GRN sehingga dokumen, stok, dan barang masuk
 * ikut batal.
 */
export class GoodsReceiptExceedsRemainingError extends Error {
  readonly purchaseOrderItemId: string;

  constructor(purchaseOrderItemId: string) {
    super(
      "Jumlah barang yang masuk melebihi sisa pesanan karena pesanan ini baru saja berubah. Muat ulang halaman, lalu coba lagi.",
    );
    this.name = "GoodsReceiptExceedsRemainingError";
    this.purchaseOrderItemId = purchaseOrderItemId;
  }
}

/** Pesanan milik pengajuan restock tidak boleh diterima dari halaman Pembelian. */
export class GoodsReceiptRestockOrderError extends Error {
  constructor() {
    super(RESTOCK_ORDER_RECEIPT_MESSAGE);
    this.name = "GoodsReceiptRestockOrderError";
  }
}
