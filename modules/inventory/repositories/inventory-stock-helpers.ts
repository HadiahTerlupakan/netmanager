import { Prisma } from "@prisma/client";
import { DEFAULT_KONDISI, STOCK_FIELD_MAP } from "@/lib/constants/inventory";

const DEFAULT_POSITIVE_STOCK_ERROR = "Jumlah harus angka bulat positif";

type InventoryCondition = keyof typeof STOCK_FIELD_MAP;
export type InventoryStockField = (typeof STOCK_FIELD_MAP)[InventoryCondition];

function isInventoryCondition(kondisi: string): kondisi is InventoryCondition {
  return kondisi in STOCK_FIELD_MAP;
}

/** Ambil field stok per kondisi inventory. */
export function getStockFieldByCondition(
  kondisi?: string,
): InventoryStockField {
  const selectedCondition = kondisi || DEFAULT_KONDISI;

  if (!isInventoryCondition(selectedCondition)) {
    return STOCK_FIELD_MAP.BARU;
  }

  return STOCK_FIELD_MAP[selectedCondition];
}

/** Pastikan jumlah stok keluar berupa bilangan bulat positif. */
export function assertPositiveIntegerQuantity(quantity: number): void {
  if (Math.floor(quantity) !== quantity) {
    throw new Error("Jumlah tidak boleh angka desimal");
  }

  if (quantity <= 0) {
    throw new Error(DEFAULT_POSITIVE_STOCK_ERROR);
  }
}

/** Ambil stok per kondisi dari record gudang secara aman. */
export function getConditionStockAmount(
  stockRecord: Record<string, unknown>,
  stockField: string,
): number {
  const stockValue = stockRecord[stockField];
  return typeof stockValue === "number" ? stockValue : Number(stockValue || 0);
}

/** Bangun payload upsert stok gudang saat penambahan stok. */
export function buildIncrementBarangGudangPayload(input: {
  barangId: string;
  gudangId: string;
  quantity: number;
  kondisi?: string;
  tenantId?: string | null;
}): {
  create: Prisma.BarangGudangUncheckedCreateInput;
  update: Prisma.BarangGudangUpdateInput;
} {
  const stockField = getStockFieldByCondition(input.kondisi);

  return {
    create: {
      id: crypto.randomUUID(),
      barangId: input.barangId,
      gudangId: input.gudangId,
      stok: input.quantity,
      stokBaru: stockField === "stokBaru" ? input.quantity : 0,
      stokBekas: stockField === "stokBekas" ? input.quantity : 0,
      stokRusak: stockField === "stokRusak" ? input.quantity : 0,
      updatedAt: new Date(),
      tenantId: input.tenantId || null,
    },
    update: {
      stok: { increment: input.quantity },
      [stockField]: { increment: input.quantity },
      updatedAt: new Date(),
    } as Prisma.BarangGudangUpdateInput,
  };
}

/** Bangun payload pengurangan stok gudang saat stok keluar. */
export function buildDecrementBarangGudangPayload(input: {
  stockField: string;
  quantity: number;
}): Prisma.BarangGudangUpdateInput {
  return {
    stok: { decrement: input.quantity },
    [input.stockField]: { decrement: input.quantity },
  } as Prisma.BarangGudangUpdateInput;
}
