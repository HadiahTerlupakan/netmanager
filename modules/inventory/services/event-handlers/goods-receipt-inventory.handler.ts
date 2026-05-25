import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";

const SOURCE = "GoodsReceiptInventoryHandler";

interface ItemPayload {
  barangId: string;
  quantity: number;
}

/**
 * Handler GRN_CREATED → tambah stok di gudang.
 *
 * Pakai upsert pada `BarangGudang` (unique by barangId+gudangId): kalau
 * sudah ada → increment, kalau belum → create. Stok yang ditambah masuk
 * `stokBaru` (kategori barang baru dari vendor). Idempotent: kalau retry
 * delivery (BullMQ at-least-once), penjumlahan tetap masuk dua kali, jadi
 * pastikan event publisher tidak emit dua kali untuk transaksi yang sama.
 */
export async function handleGoodsReceiptCreatedInventory(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const goodsReceiptId = requirePayloadString(
    payload.goodsReceiptId,
    "goodsReceiptId",
    SOURCE,
  );
  const gudangId = requirePayloadString(payload.gudangId, "gudangId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const items = (payload.items as ItemPayload[]) ?? [];

  if (items.length === 0) {
    logger.warn(`[${SOURCE}] GRN ${goodsReceiptId} tidak punya items, skip`);
    return;
  }

  const now = new Date();
  for (const item of items) {
    if (!item.barangId || !item.quantity) continue;
    await prisma.barangGudang.upsert({
      where: {
        barangId_gudangId: { barangId: item.barangId, gudangId },
      },
      create: {
        id: crypto.randomUUID(),
        barangId: item.barangId,
        gudangId,
        stok: item.quantity,
        stokBaru: item.quantity,
        stokBekas: 0,
        stokRusak: 0,
        tenantId,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        stok: { increment: item.quantity },
        stokBaru: { increment: item.quantity },
        updatedAt: now,
      },
    });
  }

  logger.info(
    `[${SOURCE}] Stok updated dari GRN ${goodsReceiptId} (${items.length} item)`,
  );
}
