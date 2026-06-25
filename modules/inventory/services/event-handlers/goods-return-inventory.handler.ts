import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";

const SOURCE = "GoodsReturnInventoryHandler";

interface ItemPayload {
  barangId: string;
  quantity: number;
}

/**
 * Handler RTV_SENT → kurangi stok dari gudang.
 *
 * Decrement langsung pakai `decrement`. Stok dikurangi dari `stokBaru`
 * (asumsi retur barang yang baru diterima). Kalau record `BarangGudang`
 * tidak ada (mis. data inkonsisten), log warning dan skip — jangan crash
 * supaya RTV record tetap valid di DB.
 */
export async function handleGoodsReturnSentInventory(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const goodsReturnId = requirePayloadString(
    payload.goodsReturnId,
    "goodsReturnId",
    SOURCE,
  );
  const gudangId = requirePayloadString(payload.gudangId, "gudangId", SOURCE);
  const items = (payload.items as ItemPayload[]) ?? [];

  if (items.length === 0) {
    logger.warn(`[${SOURCE}] RTV ${goodsReturnId} tidak punya items, skip`);
    return;
  }

  const now = new Date();
  for (const item of items) {
    if (!item.barangId || !item.quantity) continue;
    const existing = await prisma.barangGudang.findUnique({
      where: {
        barangId_gudangId: { barangId: item.barangId, gudangId },
      },
    });
    if (!existing) {
      logger.warn(
        `[${SOURCE}] BarangGudang barangId=${item.barangId} gudangId=${gudangId} tidak ada, skip decrement`,
      );
      continue;
    }
    if (existing.stokBaru < item.quantity || existing.stok < item.quantity) {
      logger.error(
        `[${SOURCE}] Stok tidak cukup untuk RTV: stok=${existing.stok} stokBaru=${existing.stokBaru} qty=${item.quantity}, skip decrement untuk menghindari stok minus`,
      );
      continue;
    }
    await prisma.barangGudang.update({
      where: { id: existing.id },
      data: {
        stok: { decrement: item.quantity },
        stokBaru: { decrement: item.quantity },
        updatedAt: now,
      },
    });
  }

  logger.info(
    `[${SOURCE}] Stok dikurangi dari RTV ${goodsReturnId} (${items.length} item)`,
  );
}
