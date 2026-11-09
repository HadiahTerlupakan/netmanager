// Client-safe public API: hanya re-export domain constants dan validator
// yang aman dipakai di client components, tanpa membawa server-only services
// (firebase-admin, prisma, websocket emitter, dll) ke client bundle.

export {
  OPNAME_PESAN,
  pesanKondisiMelebihiStokFisik,
} from "./domain/opname-pesan";

export {
  STOCK_THRESHOLD,
  getStockStatus,
  getStockLabel,
  type StockStatus,
} from "./domain/constants";

export {
  BARANG_VALIDATION,
  BARANG_JENIS,
  BARANG_KATEGORI_ASET,
  barangFormSchema,
  validateBarangForm,
  sanitizeBarangInput,
  type BarangJenis,
  type BarangKategoriAset,
  type BarangFormInput,
  type BarangFormOutput,
} from "./validators/barangValidator";

export {
  labelKondisiTransfer,
  TRANSFER_MESSAGES,
} from "./domain/transfer-errors";

export { describeInventoryMutationProblems } from "./services/inventory-route-validation.helpers";
export { labelKondisiBarang } from "./domain/inventory-user-error";

// Aturan tahap verifikasi barang sampai (dipakai layar restock).
export {
  canReceiveWithoutPurchaseReport,
  getOutstandingQuantity,
  getPurchasedAwaitingArrival,
  getReceiveLimit,
  getUnpurchasedRemainder,
  isLegacyPurchasedOrder,
  isMergedRestockOrder,
  RESTOCK_RECEIPT_ELIGIBILITY_MESSAGES,
  type RestockPurchaseEvidence,
  type RestockReceiptItemQuantities,
  type RestockReceiptItemWithPurchase,
} from "./domain/restock-receipt-eligibility";
