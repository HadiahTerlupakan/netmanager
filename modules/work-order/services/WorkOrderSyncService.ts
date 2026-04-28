import { logger } from "@/lib/logger";
import type { WorkOrderAttachments } from "@prisma/client";
import { WorkOrderStatus, TicketStatus } from "@prisma/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { randomUUID } from "crypto";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { TicketRepository } from "../repositories/TicketRepository";

let workOrderRepository: WorkOrderRepository | null = null;
let ticketRepository: TicketRepository | null = null;

/** Return a lazily-created work-order repository. */
function getWorkOrderRepository() {
  workOrderRepository ??= new WorkOrderRepository();
  return workOrderRepository;
}

/** Return a lazily-created ticket repository. */
function getTicketRepository() {
  ticketRepository ??= new TicketRepository();
  return ticketRepository;
}

export async function syncWoStatusToTicket(
  workOrderId: string,
  status: WorkOrderStatus,
) {
  try {
    const workOrder =
      await getWorkOrderRepository().findByIdWithTicketAndAttachments(
        workOrderId,
      );

    if (!workOrder) {
      return;
    }

    if (!workOrder.ticketId) {
      return;
    }

    if (status === "IN_PROGRESS") {
      await getTicketRepository().updateStatus(
        workOrder.ticketId,
        TicketStatus.IN_PROGRESS,
      );
    } else if (status === "COMPLETED") {
      await getTicketRepository().updateStatus(
        workOrder.ticketId,
        TicketStatus.RESOLVED,
      );

      const completionPhotos = (
        workOrder.attachments as WorkOrderAttachments[]
      ).filter((a: WorkOrderAttachments) =>
        a.caption?.startsWith("[COMPLETION]"),
      );

      let message =
        `**Laporan Pekerjaan Selesai**\n\n` +
        `Work Order #${workOrder.workOrderNumber} telah diselesaikan.\n` +
        `Judul: ${workOrder.title}\n` +
        `Waktu Selesai: ${format(new Date(), "dd MMMM yyyy HH:mm", { locale: id })}\n\n` +
        `**Keterangan:**\n${workOrder.resolutionNotes || workOrder.description || "-"}\n`;

      if (completionPhotos.length > 0) {
        message += `\n**Bukti Foto:**\n`;
      }

      const attachUrls = completionPhotos.map(
        (p: WorkOrderAttachments) => p.filePath,
      );

      await getTicketRepository().createReply({
        id: randomUUID(),
        ticketId: workOrder.ticketId,
        message: message,
        isFromAdmin: true,
        senderId: workOrder.assignedToId,
        attachments:
          attachUrls.length > 0 ? JSON.stringify(attachUrls) : undefined,
      });
    }
  } catch (error) {
    logger.error("Error syncing WO to Ticket:", error);
  }
}

export async function closeWoOnTicketClose(ticketId: string) {
  try {
    const workOrderRepo = getWorkOrderRepository();
    const wos = await workOrderRepo.findManyByTicketId(ticketId);

    for (const wo of wos) {
      if (wo.status === "PENDING") {
        await workOrderRepo.update(wo.id, {
          status: "CANCELLED",
          resolutionNotes: "Tiket ditutup sebelum WO diambil",
        });
      } else if (
        wo.status === "ASSIGNED" ||
        wo.status === "IN_PROGRESS" ||
        wo.status === "ON_HOLD"
      ) {
        await workOrderRepo.update(wo.id, {
          status: "CLOSED",
          resolutionNotes: "Tiket ditutup manual oleh Admin",
        });
      } else if (wo.status === "COMPLETED" || wo.status === "VERIFIED") {
        await workOrderRepo.update(wo.id, {
          status: "CLOSED",
        });
      }
    }
  } catch (error) {
    logger.error("Error closing WOs for ticket:", error);
  }
}
