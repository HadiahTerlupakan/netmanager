import {
  TicketStatus,
  type WorkOrderAttachments,
} from "../types/work-order.enums";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { TicketEventDispatcher } from "@/modules/events";
import type { TicketRepository } from "../repositories/TicketRepository";

type WorkOrderWithTicket = Awaited<
  ReturnType<
    typeof import("../repositories/WorkOrderRepository").WorkOrderRepository.prototype.findByIdWithTicketAndAttachments
  >
>;

/**
 * Kabarkan progres WO ke pihak tiket (sales pelapor) lewat event. Tidak pernah
 * melempar: kegagalan publish tidak boleh menggagalkan alur WO.
 */
export async function publishTicketWoProgress(
  data: Parameters<typeof TicketEventDispatcher.onWoProgress>[0],
): Promise<void> {
  await TicketEventDispatcher.onWoProgress(data).catch((error) =>
    logger.error("Failed to publish TICKET_WO_PROGRESS event:", error),
  );
}

export async function syncInProgressTicket(
  ticketRepository: TicketRepository,
  ticketId: string,
) {
  await ticketRepository.updateStatus(ticketId, TicketStatus.IN_PROGRESS);
}

export async function syncCompletedTicket(
  ticketRepository: TicketRepository,
  workOrder: NonNullable<WorkOrderWithTicket>,
) {
  await ticketRepository.updateStatus(
    workOrder.ticketId!,
    TicketStatus.RESOLVED,
  );
  await ticketRepository.createReply({
    id: randomUUID(),
    ticketId: workOrder.ticketId!,
    message: buildCompletionMessage(workOrder),
    isFromAdmin: true,
    senderId: workOrder.assignedToId,
    attachments: buildCompletionAttachments(workOrder),
  });
}

function buildCompletionMessage(workOrder: NonNullable<WorkOrderWithTicket>) {
  const completionPhotos = getCompletionPhotos(workOrder);
  let message =
    `**Laporan Pekerjaan Selesai**\n\n` +
    `Work Order #${workOrder.workOrderNumber} telah diselesaikan.\n` +
    `Judul: ${workOrder.title}\n` +
    `Waktu Selesai: ${format(new Date(), "dd MMMM yyyy HH:mm", { locale: id })}\n\n` +
    `**Keterangan:**\n${workOrder.resolutionNotes || workOrder.description || "-"}\n`;

  if (completionPhotos.length > 0) message += `\n**Bukti Foto:**\n`;
  return message;
}

function buildCompletionAttachments(
  workOrder: NonNullable<WorkOrderWithTicket>,
) {
  const attachUrls = getCompletionPhotos(workOrder).map(
    (photo) => photo.filePath,
  );
  return attachUrls.length > 0 ? JSON.stringify(attachUrls) : undefined;
}

function getCompletionPhotos(workOrder: NonNullable<WorkOrderWithTicket>) {
  return (workOrder.attachments as WorkOrderAttachments[]).filter(
    (attachment) => attachment.caption?.startsWith("[COMPLETION]"),
  );
}
