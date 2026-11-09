/** Galat bertipe pencatatan barang datang (GRN) yang dipakai lintas lapisan. */

/** Pesan untuk petugas saat pesanan restock dicatat dari halaman Pembelian. */
export const RESTOCK_ORDER_RECEIPT_MESSAGE =
  "Pesanan ini dari pengajuan restock. Catat barang datang dari halaman Restock.";

/**
 * Jumlah datang melebihi jumlah yang sudah dilaporkan dibeli. Dilempar di
 * dalam transaksi GRN sehingga dokumen, stok, dan barang masuk ikut batal.
 */
export class GoodsReceiptExceedsPurchasedError extends Error {
  constructor(purchaseOrderItemId: string) {
    super(
      `Jumlah datang item ${purchaseOrderItemId} melebihi jumlah yang sudah dibeli`,
    );
    this.name = "GoodsReceiptExceedsPurchasedError";
  }
}

/** Pesanan milik pengajuan restock tidak boleh diterima dari halaman Pembelian. */
export class GoodsReceiptRestockOrderError extends Error {
  constructor() {
    super(RESTOCK_ORDER_RECEIPT_MESSAGE);
    this.name = "GoodsReceiptRestockOrderError";
  }
}
