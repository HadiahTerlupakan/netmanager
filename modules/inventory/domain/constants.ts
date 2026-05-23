/**
 * Threshold stok untuk klasifikasi badge UI dan logika low-stock alert.
 *
 * STOCK_OUT: stok habis (== 0) → red badge.
 * STOCK_LOW: stok di bawah angka ini → yellow badge.
 * Selain itu hijau (tersedia).
 *
 * Dipakai oleh BarangTable, BarangDetailClient, ExtendedStatsCards,
 * dan komponen lain yang menampilkan status stok.
 */
export const STOCK_THRESHOLD = {
  OUT: 0,
  LOW: 5,
} as const;

export type StockStatus = "out" | "low" | "available";

export function getStockStatus(stock: number): StockStatus {
  if (stock <= STOCK_THRESHOLD.OUT) return "out";
  if (stock < STOCK_THRESHOLD.LOW) return "low";
  return "available";
}

export function getStockLabel(stock: number): string {
  const status = getStockStatus(stock);
  if (status === "out") return "Habis";
  if (status === "low") return "Menipis";
  return "Tersedia";
}
