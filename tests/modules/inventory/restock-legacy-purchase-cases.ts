/**
 * Tabel kasus "data lama" (pesanan ditandai dibeli sekaligus, atau barangnya
 * sudah datang, tanpa catatan belanja) yang dipakai bersama oleh tes domain dan tes layar, supaya aturan
 * server dan layar dijamin sama.
 */
export interface LegacyPurchaseCase {
  name: string;
  purchaseOrderStatus: string;
  issuedAt: string | null;
  /** Jumlah catatan belanja yang sudah dibatalkan. */
  voidedRecordCount: number;
  purchasedQuantity: number;
  receivedQuantity: number;
  /** Waktu kiriman pertama; null bila belum ada kiriman. */
  firstReceiptAt: string | null;
  expected: boolean;
}

export const LEGACY_PURCHASE_CASES: LegacyPurchaseCase[] = [
  {
    name: "catatan belanja yang dibatalkan membuatnya bukan data lama",
    purchaseOrderStatus: "ORDERED",
    issuedAt: "2026-10-01T00:00:00.000Z",
    voidedRecordCount: 1,
    purchasedQuantity: 0,
    receivedQuantity: 0,
    firstReceiptAt: null,
    expected: false,
  },
  {
    name: "ada jumlah dibeli berarti bukan data lama",
    purchaseOrderStatus: "ORDERED",
    issuedAt: "2026-10-01T00:00:00.000Z",
    voidedRecordCount: 0,
    purchasedQuantity: 2,
    receivedQuantity: 0,
    firstReceiptAt: null,
    expected: false,
  },
  {
    name: "tanggal beli sebelum kiriman pertama adalah data lama",
    purchaseOrderStatus: "PARTIAL",
    issuedAt: "2026-10-01T00:00:00.000Z",
    voidedRecordCount: 0,
    purchasedQuantity: 0,
    receivedQuantity: 3,
    firstReceiptAt: "2026-10-05T00:00:00.000Z",
    expected: true,
  },
  {
    name: "tanggal beli sesudah kiriman pertama (alur lama) tetap data lama",
    purchaseOrderStatus: "PARTIAL",
    issuedAt: "2026-10-06T00:00:00.000Z",
    voidedRecordCount: 0,
    purchasedQuantity: 0,
    receivedQuantity: 3,
    firstReceiptAt: "2026-10-05T00:00:00.000Z",
    expected: true,
  },
  {
    name: "tanggal beli tanpa kiriman adalah data lama",
    purchaseOrderStatus: "ORDERED",
    issuedAt: "2026-10-01T00:00:00.000Z",
    voidedRecordCount: 0,
    purchasedQuantity: 0,
    receivedQuantity: 0,
    firstReceiptAt: null,
    expected: true,
  },
  {
    name: "ORDERED tanpa tanggal dan tanpa barang datang adalah data lama",
    purchaseOrderStatus: "ORDERED",
    issuedAt: null,
    voidedRecordCount: 0,
    purchasedQuantity: 0,
    receivedQuantity: 0,
    firstReceiptAt: null,
    expected: true,
  },
  {
    name: "PARTIAL tanpa tanggal (diterima di halaman Pembelian) adalah data lama",
    purchaseOrderStatus: "PARTIAL",
    issuedAt: null,
    voidedRecordCount: 0,
    purchasedQuantity: 0,
    receivedQuantity: 3,
    firstReceiptAt: "2026-10-05T00:00:00.000Z",
    expected: true,
  },
  {
    name: "barang datang dengan catatan belanja dibatalkan bukan data lama",
    purchaseOrderStatus: "PARTIAL",
    issuedAt: null,
    voidedRecordCount: 1,
    purchasedQuantity: 0,
    receivedQuantity: 3,
    firstReceiptAt: "2026-10-05T00:00:00.000Z",
    expected: false,
  },
  {
    name: "DRAFT tanpa tanggal bukan data lama",
    purchaseOrderStatus: "DRAFT",
    issuedAt: null,
    voidedRecordCount: 0,
    purchasedQuantity: 0,
    receivedQuantity: 0,
    firstReceiptAt: null,
    expected: false,
  },
];
