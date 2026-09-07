import { logger } from "@/lib/logger";
/**
 * Work Order Notification Integration
 *
 * This module handles notification triggers when work order events occur.
 * It's designed to be called from API routes after work order operations.
 */

import {
  notifyNewWorkOrder,
  notifyWorkOrderAssigned,
  notifyWorkOrderStatusChange,
  notifyWorkOrderUpdate,
  createNotification,
  sendPushToUsers,
} from "@/modules/notification";
import { WhatsAppSenderService } from "@/modules/notification";
import { CanvasingRepository } from "../repositories/CanvasingRepository";
import { UserLookupService } from "@/modules/users";

let canvasingRepo: CanvasingRepository | null = null;
let userRepo: UserLookupService | null = null;
let waSender: WhatsAppSenderService | null = null;

function getCanvasingRepository() {
  if (!canvasingRepo) {
    canvasingRepo = new CanvasingRepository();
  }
  return canvasingRepo;
}

function getUserLookupService() {
  if (!userRepo) {
    userRepo = new UserLookupService();
  }
  return userRepo;
}

function getWaSender() {
  if (!waSender) {
    waSender = new WhatsAppSenderService();
  }
  return waSender;
}

interface WorkOrderData {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  departmentId?: string | null;
  siteId?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
}

/**
 * Trigger notification when a new Work Order is created
 * - In-app + push ke karyawan eligible di site/dept
 * - WA INTERNAL ke teknisi di site+dept (jika punya nomor HP)
 */
export async function onWorkOrderCreated(
  workOrder: WorkOrderData,
  triggeredByUserId?: string,
) {
  try {
    await Promise.all([
      notifyNewWorkOrder({
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId || undefined,
        siteId: workOrder.siteId || undefined,
        triggeredByUserId,
      }),
      sendNewWorkOrderWhatsApp(workOrder, triggeredByUserId),
    ]);
  } catch (error) {
    logger.error("[Notification] Error sending new WO notification:", error);
  }
}

/**
 * Kirim WA notifikasi WO baru ke teknisi di site+dept.
 * Link HTTPS (https://radpro.id/w/<id>) → redirect ke deep link mobile app.
 */
async function sendNewWorkOrderWhatsApp(
  workOrder: WorkOrderData,
  excludeUserId?: string,
): Promise<void> {
  try {
    if (!workOrder.siteId) {
      logger.warn(
        `[WO New WA] Skip: WO ${workOrder.workOrderNumber} tanpa siteId`,
      );
      return;
    }

    const technicians =
      await getUserLookupService().findManyActiveWithPhoneAndSite(
        workOrder.departmentId || undefined,
        workOrder.siteId,
        excludeUserId,
      );

    const withPhone = technicians.filter(
      (t): t is typeof t & { phone: string } => Boolean(t.phone?.trim()),
    );

    if (withPhone.length === 0) {
      logger.info(
        `[WO New WA] Tidak ada teknisi ber-HP di site=${workOrder.siteId} dept=${workOrder.departmentId ?? "-"}`,
      );
      return;
    }

    const message = buildNewWorkOrderWhatsAppMessage(workOrder);
    await Promise.all(
      withPhone.map((t) => sendWhatsAppReminderToUser(t.id, message, t.phone)),
    );

    logger.info(
      `[WO New WA] Sent to ${withPhone.length} teknisi for ${workOrder.workOrderNumber}`,
    );
  } catch (error) {
    logger.error(`[WO New WA] Error for ${workOrder.workOrderNumber}:`, error);
  }
}

function buildNewWorkOrderWhatsAppMessage(workOrder: WorkOrderData): string {
  const deepLink = buildWorkOrderDeepLink(workOrder.id);
  const priorityLabel = formatPriorityLabel(workOrder.priority);
  const typeLabel = workOrder.type || "-";

  return (
    `*Work Order Baru* 📋\n\n` +
    `Nomor: *${workOrder.workOrderNumber}*\n` +
    `Judul: ${workOrder.title}\n` +
    `Tipe: ${typeLabel}\n` +
    `Prioritas: ${priorityLabel}\n\n` +
    `Ambil tiket di aplikasi NetManager:\n` +
    `${deepLink}`
  );
}

/** HTTPS redirect URL yang clickable di WhatsApp → buka deep link mobile. */
function buildWorkOrderDeepLink(workOrderId: string): string {
  const base =
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "https://radpro.id";
  return `${base}/w/${workOrderId}`;
}

function formatPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    LOW: "Rendah",
    NORMAL: "Normal",
    MEDIUM: "Sedang",
    HIGH: "Tinggi",
    URGENT: "Mendesak ⚠️",
    CRITICAL: "Kritis 🚨",
  };
  return map[priority?.toUpperCase()] || priority || "Normal";
}

/**
 * Trigger notification when a Work Order is assigned to an employee
 * - Notifies the assigned employee and relevant Admins
 */
export async function onWorkOrderAssigned(
  workOrder: WorkOrderData,
  assigneeName?: string,
  triggeredByUserId?: string,
) {
  try {
    await notifyWorkOrderAssigned({
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      priority: workOrder.priority,
      assignedToId: workOrder.assignedToId || undefined,
      createdById: workOrder.createdById || undefined,
      requestedById: workOrder.requestedById || undefined,
      departmentId: workOrder.departmentId || undefined,
      siteId: workOrder.siteId || undefined,
      assigneeName,
      triggeredByUserId,
    });
    // logger.info(`[Notification] Assignment notification processed for WO: ${workOrder.workOrderNumber}`);
  } catch (error) {
    logger.error(
      "[Notification] Error sending assignment notification:",
      error,
    );
  }
}

/**
 * Trigger notification when Work Order status changes
 * - Notifies the assigned employee and relevant Admins
 * - Also notifies canvasing sales if WO is from canvasing
 */
export async function onWorkOrderStatusChanged(
  workOrder: WorkOrderData,
  oldStatus: string,
  newStatus: string,
  triggeredByUserId?: string,
) {
  try {
    await notifyWorkOrderStatusChange({
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      priority: workOrder.priority,
      assignedToId: workOrder.assignedToId || undefined,
      createdById: workOrder.createdById || undefined,
      requestedById: workOrder.requestedById || undefined,
      departmentId: workOrder.departmentId || undefined,
      siteId: workOrder.siteId || undefined,
      oldStatus,
      newStatus,
      triggeredByUserId,
    });
    // logger.info(`[Notification] Status change notification processed: ${oldStatus} -> ${newStatus}`);

    // Notify canvasing sales if this WO is from canvasing
    await notifyCanvasingSalesOnWOStatusChange(workOrder.id, newStatus);
  } catch (error) {
    logger.error(
      "[Notification] Error sending status change notification:",
      error,
    );
  }
}

/**
 * Notify canvasing sales when their WO status changes
 */
async function notifyCanvasingSalesOnWOStatusChange(
  workOrderId: string,
  newStatus: string,
) {
  try {
    // Check if this WO is linked to a canvasing
    const canvasing =
      await getCanvasingRepository().findByWorkOrderId(workOrderId);

    if (!canvasing || !canvasing.salesId) return;

    // Notify sales based on status
    if (newStatus === "IN_PROGRESS") {
      await createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: "🔧 Instalasi Sedang Dikerjakan",
        message: `Teknisi sedang mengerjakan instalasi untuk ${canvasing.nama}`,
        link: `/admin/marketing/canvasing/${canvasing.id}`,
        userId: canvasing.salesId,
        sourceType: "CANVASING",
        sourceId: canvasing.id,
      });
      logger.info(
        `[Notification] Canvasing IN_PROGRESS notif sent to sales: ${canvasing.salesId}`,
      );
    } else if (["COMPLETED", "VERIFIED", "CLOSED"].includes(newStatus)) {
      await createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: "✅ Instalasi Selesai",
        message: `Instalasi untuk ${canvasing.nama} selesai. Anda bisa claim poin sekarang!`,
        link: `/admin/marketing/canvasing/${canvasing.id}`,
        userId: canvasing.salesId,
        sourceType: "CANVASING",
        sourceId: canvasing.id,
      });

      // Send explicit push notification to ensure mobile receives it
      await sendPushToUsers(
        [canvasing.salesId],
        "✅ Instalasi Selesai",
        `Instalasi untuk ${canvasing.nama} selesai. Anda bisa claim poin sekarang!`,
        {
          canvasingId: canvasing.id,
          type: "CANVASING_COMPLETED",
          screen: "CanvasingDetail",
        },
      ).catch((error) =>
        logger.error("[Push] Error sending canvasing completion push:", error),
      );

      logger.info(
        `[Notification] Canvasing COMPLETED notif sent to sales: ${canvasing.salesId}`,
      );
    }
  } catch (error) {
    logger.error("[Notification] Error notifying canvasing sales:", error);
  }
}

/**
 * Trigger notification when Work Order is updated with a comment
 * - Notifies the assigned employee and relevant Admins
 */
export async function onWorkOrderUpdated(
  workOrder: WorkOrderData,
  updateMessage: string,
  updatedByName?: string,
  triggeredByUserId?: string,
  excludeUserIds?: string[],
) {
  try {
    await notifyWorkOrderUpdate({
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      priority: workOrder.priority,
      assignedToId: workOrder.assignedToId || undefined,
      departmentId: workOrder.departmentId || undefined,
      siteId: workOrder.siteId || undefined,
      updateMessage,
      updatedByName,
      triggeredByUserId,
      excludeUserIds,
    });
    // logger.info(`[Notification] Update notification processed for WO: ${workOrder.workOrderNumber}`);
  } catch (error) {
    logger.error("[Notification] Error sending update notification:", error);
  }
}

/**
 * Send manual reminder for a Work Order
 *
 * Logic:
 * 1. WO yang sudah diambil (assignedToId ada) → Reminder ke teknisi yang mengambil saja
 * 2. WO yang belum diambil (assignedToId null) → Reminder WAJIB ke teknisi di SITE WO tersebut
 *    - Jika departmentId diset → Filter hanya teknisi di department tersebut AND site WO
 *    - Jika tidak ada departmentId → Semua teknisi di site WO
 */
export async function sendWorkOrderReminder(
  workOrder: WorkOrderData,
  customMessage?: string,
): Promise<number> {
  try {
    const message =
      customMessage ||
      `🔔 Masih Menunggu! ${workOrder.workOrderNumber} - ${workOrder.title}`;
    const title = "⚠️ Work Order Reminder";

    // Case 1: WO sudah diambil → Reminder hanya ke teknisi yang mengambil
    if (workOrder.assignedToId) {
      const sentPush = await sendPushToUsers(
        [workOrder.assignedToId],
        title,
        message,
        {
          workOrderId: workOrder.id,
          type: "WORK_ORDER",
          screen: "WorkOrderDetail",
        },
      );
      await sendWhatsAppReminderToUser(workOrder.assignedToId, message);
      return sentPush;
    }

    // Case 2: WO belum diambil → WAJIB berdasarkan site
    if (!workOrder.siteId) {
      return 0;
    }

    const techniciansInSite =
      await getUserLookupService().findManyActiveWithPushTokenAndSite(
        workOrder.departmentId || undefined,
        workOrder.siteId,
      );

    if (techniciansInSite.length === 0) {
      return 0;
    }

    const userIds = techniciansInSite.map((u: { id: string }) => u.id);

    const sentPush = await sendPushToUsers(userIds, title, message, {
      workOrderId: workOrder.id,
      type: "WORK_ORDER",
      screen: "WorkOrderList",
    });

    await Promise.all(
      techniciansInSite.map((t) =>
        sendWhatsAppReminderToUser(t.id, message, t.phone),
      ),
    );

    return sentPush;
  } catch (error) {
    logger.error("[Notification] Error sending reminder:", error);
    return 0;
  }
}

async function sendWhatsAppReminderToUser(
  userId: string,
  message: string,
  phone?: string | null,
): Promise<void> {
  try {
    const targetPhone =
      phone ?? (await getUserLookupService().findById(userId))?.phone;
    if (!targetPhone) return;

    const result = await getWaSender().send({
      phone: targetPhone,
      message,
      accountType: "INTERNAL",
    });

    if (!result.success) {
      logger.warn(
        `[WO Reminder] WA failed for user ${userId}: ${result.error}`,
      );
    }
  } catch (err) {
    logger.warn(
      `[WO Reminder] WA send error for user ${userId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
