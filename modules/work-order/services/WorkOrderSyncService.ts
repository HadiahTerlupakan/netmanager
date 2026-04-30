import { logger } from "@/lib/logger";
import { WorkOrderStatus } from "@prisma/client";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { TicketRepository } from "../repositories/TicketRepository";
import {
  syncCompletedTicket,
  syncInProgressTicket,
} from "./work-order-sync.helpers";

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

    const ticketRepository = getTicketRepository();
    if (status === "IN_PROGRESS") {
      await syncInProgressTicket(ticketRepository, workOrder.ticketId);
      return;
    }
    if (status === "COMPLETED") {
      await syncCompletedTicket(ticketRepository, workOrder);
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
