// Client-safe public API modul procurement: hanya konstanta domain murni,
// tanpa service/repository (Prisma) yang tidak boleh ikut ke client bundle.

export { RESTOCK_ORDER_RECEIPT_MESSAGE } from "./domain/goods-receipt-errors";
