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

// Status pengajuan restock dan tindakan yang boleh (layar admin, PDF, dan
// presenter mobile memakai aturan yang sama dengan server).
export {
  APPROVED_OPEN_RESTOCK_STATUSES,
  AWAITING_APPROVAL_RESTOCK_STATUSES,
  canCancelRestockRequest,
  canDeleteRestockRequest,
  canEditRestockRequest,
  canEnterRestockGoods,
  getRequestedQuantity,
  getRestockLineProgress,
  getRestockStatusKey,
  hasRestockEnteredAnything,
  hasRestockJasaDone,
  isRestockClosed,
  isRestockLineRejected,
  isRestockMergedOrder,
  isRestockServiceOnly,
  NOT_ENTERED_CANCEL_REASON,
  isNotEnteredCancelReason,
  RESTOCK_EDITABLE_STATUSES,
  RESTOCK_JASA_DONE_STATUS,
  RESTOCK_STATUS_LABELS,
  wasRestockLineSubstituted,
  type RestockLineProgress,
  type RestockStatusInput,
  type RestockStatusJasa,
  type RestockStatusKey,
  type RestockStatusLine,
  type RestockStatusOrder,
} from "./domain/restock-request-status";
