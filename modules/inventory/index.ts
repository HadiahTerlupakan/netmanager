// Services
export * from "./services/AssetService";
export * from "./services/DepreciationCronService";
export * from "./services/InventoryBarangService";
export * from "./services/InventoryBarangRouteService";
export * from "./services/InventoryGudangRouteService";
export * from "./services/inventory-master-data-errors";
export * from "./services/InventoryTransferRouteService";
export * from "./services/InventoryMasukRouteService";
export * from "./services/InventoryKeluarRouteService";
export * from "./services/InventoryStockMovementService";
export * from "./services/InventoryRestockCheckService";
export * from "./services/InventoryOpnameService";
export * from "./services/InventoryOpnameRouteService";
export * from "./services/InventoryDashboardService";
export * from "./services/InventoryQueryService";
export * from "./services/InventoryRouteService";
export * from "./services/InventoryPhotoUploadService";
export * from "./services/InventoryStockEffectService";
export * from "./services/RestockRequestService";
export type {
  RestockApproveCommand,
  RestockLifecycleCommand,
  RestockLifecycleErrorCode,
  RestockLifecycleResult,
  RestockRejectCommand,
} from "./services/RestockRequestLifecycleService";
export * from "./services/RestockJasaConfirmService";
export * from "./services/RestockGoodsReceiptService";
export * from "./services/RestockItemSubstitutionService";
export * from "./services/RestockItemCancellationService";
export { createRestockGoodsReceiptService } from "./factories/RestockGoodsReceiptFactory";
export { createRestockPurchaseRecordService } from "./factories/RestockPurchaseRecordFactory";
export type {
  RecordRestockPurchaseCommand,
  RestockPurchaseRecordErrorCode,
  VoidRestockPurchaseCommand,
  VoidRestockPurchaseErrorCode,
  RestockPurchaseRecordResult,
  RestockPurchaseRecordView,
  PurchaseRecordOrigin,
} from "./services/RestockPurchaseRecordService";
export {
  createRestockPurchaseLinkService,
  createRestockPublicPurchaseService,
  createRestockPurchaseSignatureReader,
} from "./factories/RestockPurchaseLinkFactory";
export { buildPurchaseLinkUrl } from "./services/restock-purchase-link-url";
export {
  PURCHASE_LINK_MESSAGES,
  type PurchaseLinkAvailability,
} from "./domain/restock-purchase-link";
export type { PurchaseLinkSummary } from "./domain/ports/IRestockPurchaseLinkRepository";
export type {
  PurchaseLinkErrorCode,
  PurchaseLinkStatus,
} from "./services/RestockPurchaseLinkService";
export type {
  PublicPurchaseClient,
  PublicPurchaseErrorCode,
  PublicPurchaseListItem,
  PublicPurchaseListView,
  PublicPurchaseSubmitInput,
  PublicPurchaseSubmitOutcome,
  UsablePurchaseLink,
} from "./services/RestockPublicPurchaseService";
export * from "./services/JasaService";
export * from "./services/MobileInventoryService";
export type { MobileInventoryError } from "./services/mobile-inventory.types";
export * from "./services/InventoryStockService";
export * from "./services/InventoryPhotoQueryService";
export * from "./services/InventoryAccessService";

// DTO
export * from "./dto/AssetDTO";

// Domain constants (public API for UI consumers)
export {
  STOCK_THRESHOLD,
  getStockStatus,
  getStockLabel,
  type StockStatus,
} from "./domain/constants";

// Validators (public API for cross-layer access)
export {
  OPNAME_REASON_CODES,
  opnameItemSchema,
  opnameBatchSchema,
  opnameUpdateSchema,
  type OpnameReasonCode,
  type OpnameItemInput,
  type OpnameBatchInput,
  type OpnameUpdateInput,
} from "./validators/opnameValidator";

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
  ASSET_STATUSES,
  LABEL_STATUS_ASET,
  createAssetSchema,
  updateAssetSchema,
  depreciateAssetSchema,
  type AssetStatusValue,
} from "./validators/assetValidator";

// Event handlers
export { handleGoodsReceiptCreatedInventory } from "./services/event-handlers/goods-receipt-inventory.handler";
export { handleGoodsReturnSentInventory } from "./services/event-handlers/goods-return-inventory.handler";

// Jadwal & kepatuhan stock opname bulanan
export {
  StockOpnameJadwalService,
  getStockOpnameJadwalService,
} from "./services/StockOpnameJadwalService";
export type {
  JadwalKhususSite,
  JadwalSoSite,
  KepatuhanGudang,
  KepatuhanSite,
  LaporanKepatuhanSo,
  RiwayatPerubahanOpname,
} from "./services/StockOpnameJadwalService";
export {
  StockOpnamePengingatService,
  runStockOpnameReminderCron,
} from "./services/StockOpnamePengingatService";
export { periodeDari as periodeStockOpnameDari } from "./domain/jadwal-stock-opname";
export { OPNAME_PESAN, pesanGagalMuatOpname } from "./domain/opname-pesan";
export { bolehAksesGudang } from "./services/lingkup-gudang";
export {
  IZIN_PEMBATAS_BARANG,
  IZIN_PEMBATAS_GUDANG,
  IZIN_PEMBATAS_KELUAR,
  IZIN_PEMBATAS_MASUK,
  IZIN_PEMBATAS_OPNAME,
  IZIN_PEMBATAS_RESTOCK,
  IZIN_PEMBATAS_TRANSFER,
} from "./domain/izin-pembatas-site";
