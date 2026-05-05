import { logger } from "@/lib/logger";
import type { UpdateWorkOrderData } from "../domain/ports/IWorkOrderRepository";
import { WorkOrderStatus } from "../types/work-order.enums";
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

    for (const workOrder of wos) {
      await closeWorkOrderForClosedTicket(workOrderRepo, workOrder);
    }
  } catch (error) {
    logger.error("Error closing WOs for ticket:", error);
  }
}

async function closeWorkOrderForClosedTicket(
  repository: WorkOrderRepository,
  workOrder: Awaited<
    ReturnType<WorkOrderRepository["findManyByTicketId"]>
  >[number],
) {
  const updateData = buildClosedTicketWorkOrderUpdate(workOrder.status);
  if (!updateData) {
    return;
  }

  await repository.update(workOrder.id, updateData);
}

function buildClosedTicketWorkOrderUpdate(
  status: WorkOrderStatus,
): UpdateWorkOrderData | null {
  if (status === "PENDING") {
    return {
      status: "CANCELLED",
      resolutionNotes: "Tiket ditutup sebelum WO diambil",
    };
  }
  if (
    status === "ASSIGNED" ||
    status === "IN_PROGRESS" ||
    status === "ON_HOLD"
  ) {
    return {
      status: "CLOSED",
      resolutionNotes: "Tiket ditutup manual oleh Admin",
    };
  }
  if (status === "COMPLETED" || status === "VERIFIED") {
    return { status: "CLOSED" };
  }

  return null;
}
