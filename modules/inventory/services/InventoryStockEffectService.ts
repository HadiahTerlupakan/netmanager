import { logger, logActivitySafe } from "@/lib/logger";

interface InventoryStockEffectInput {
  userId: string;
  barangId: string;
  gudangId: string;
  parsedJumlah: number;
  finalStock: number;
  masukRecord?: { id: string } & Record<string, unknown>;
  keluarRecord?: { id: string } & Record<string, unknown>;
}

/** Extract barang name from inventory record relations when available. */
function getBarangName(record?: Record<string, unknown>) {
  const barang = record?.barang as Record<string, unknown> | undefined;
  return typeof barang?.nama === "string" ? barang.nama : undefined;
}

/** Publish inventory stock-in side effects outside controller. */
export async function logInventoryStockInEffects(
  input: InventoryStockEffectInput,
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Inventory In",
    userId: input.userId,
    details: {
      id: input.masukRecord?.id,
      barangId: input.barangId,
      gudangId: input.gudangId,
      quantity: input.parsedJumlah,
    },
  });

  const { socketEmitter } = await import("@/lib/websocket/emitter");
  socketEmitter.inventoryUpdate({
    type: "masuk",
    userId: input.userId,
    barangId: input.barangId,
    gudangId: input.gudangId,
    jumlah: input.parsedJumlah,
    totalStok: input.finalStock,
  });

  const { InventoryEventDispatcher } = await import("@/modules/events");
  await InventoryEventDispatcher.onStockIn({
    barangId: input.barangId,
    barangName: getBarangName(input.masukRecord),
    gudangId: input.gudangId,
    jumlah: input.parsedJumlah,
    totalStok: input.finalStock,
    userId: input.userId,
  }).catch((error) =>
    logger.error(
      "Failed to publish INVENTORY_STOCK_IN event",
      error instanceof Error ? error : undefined,
    ),
  );
}

/** Publish inventory stock-out side effects outside controller. */
export async function logInventoryStockOutEffects(
  input: InventoryStockEffectInput,
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Inventory Out",
    userId: input.userId,
    details: {
      id: input.keluarRecord?.id,
      barangId: input.barangId,
      gudangId: input.gudangId,
      quantity: input.parsedJumlah,
    },
  });

  const { socketEmitter } = await import("@/lib/websocket/emitter");
  socketEmitter.inventoryUpdate({
    type: "keluar",
    userId: input.userId,
    barangId: input.barangId,
    gudangId: input.gudangId,
    jumlah: input.parsedJumlah,
    totalStok: input.finalStock,
  });

  const { InventoryEventDispatcher } = await import("@/modules/events");
  await InventoryEventDispatcher.onStockOut({
    barangId: input.barangId,
    barangName: getBarangName(input.keluarRecord),
    gudangId: input.gudangId,
    jumlah: input.parsedJumlah,
    totalStok: input.finalStock,
    userId: input.userId,
  }).catch((error) =>
    logger.error(
      "Failed to publish INVENTORY_STOCK_OUT event",
      error instanceof Error ? error : undefined,
    ),
  );
}
