// Services
export * from "./services/AssetService";
export * from "./services/DepreciationCronService";
export * from "./services/InventoryBarangService";
export * from "./services/InventoryBarangRouteService";
export * from "./services/InventoryGudangRouteService";
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

// Event handlers
export { handleGoodsReceiptCreatedInventory } from "./services/event-handlers/goods-receipt-inventory.handler";
export { handleGoodsReturnSentInventory } from "./services/event-handlers/goods-return-inventory.handler";
