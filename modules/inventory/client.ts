// Client-safe public API: hanya re-export domain constants dan validator
// yang aman dipakai di client components, tanpa membawa server-only services
// (firebase-admin, prisma, websocket emitter, dll) ke client bundle.

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
