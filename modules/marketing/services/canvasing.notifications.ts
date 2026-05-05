import { logger } from "@/lib/logger";
import { createNotification, notifyNewCanvasing } from "@/modules/notification";
import type { CanvasingEntity } from "../domain/entities/CanvasingEntity";

const NORMAL_PRIORITY = "NORMAL" as const;
const CANVASING_SOURCE = "CANVASING" as const;

export function notifyCreatedCanvasing(canvasing: CanvasingEntity): void {
  notifyNewCanvasing({
    canvasingId: canvasing.id,
    customerName: canvasing.nama,
    salesId: canvasing.salesId,
    salesName: canvasing.user?.name || canvasing.mitra?.name || undefined,
    siteId: canvasing.user?.siteId || canvasing.mitra?.siteId,
  }).catch((error) => logger.error("[Canvasing Notif] Error:", error));
}

export function notifyApprovedCanvasing(
  request: CanvasingEntity,
  canvasingId: string,
  workOrderNumber: string,
): void {
  if (!request.salesId) {
    return;
  }

  createNotification({
    type: "ANNOUNCEMENT",
    priority: NORMAL_PRIORITY,
    title: "✅ Canvasing Disetujui",
    message: `Canvasing untuk ${request.nama} disetujui. WO #${workOrderNumber} telah dibuat.`,
    link: `/admin/marketing/canvasing/${canvasingId}`,
    userId: request.salesId,
    sourceType: CANVASING_SOURCE,
    sourceId: canvasingId,
  }).catch((error) => logger.error("[Canvasing Notif] Error:", error));
}

export function notifyRejectedCanvasing(
  request: CanvasingEntity,
  canvasingId: string,
): void {
  if (!request.salesId) {
    return;
  }

  createNotification({
    type: "ANNOUNCEMENT",
    priority: NORMAL_PRIORITY,
    title: "❌ Canvasing Ditolak",
    message: `Canvasing untuk ${request.nama} ditolak.`,
    link: `/admin/marketing/canvasing/${canvasingId}`,
    userId: request.salesId,
    sourceType: CANVASING_SOURCE,
    sourceId: canvasingId,
  }).catch((error) => logger.error("[Canvasing Notif] Error:", error));
}
