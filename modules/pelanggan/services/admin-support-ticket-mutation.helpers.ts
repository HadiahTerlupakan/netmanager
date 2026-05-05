import { logger, logActivitySafe } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { TicketEventDispatcher } from "@/modules/events";
import { closeWoOnTicketClose } from "@/modules/work-order";
/**
 * NOTE: Prisma import is intentionally kept here for type safety.
 * This helper uses Prisma types for dynamic query building and updates.
 * Removing this would require duplicating all Prisma types or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import { Prisma } from "@prisma/client";
import { TicketStatus, type TicketPriority } from "../types/pelanggan.enums";
import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import type { ServiceResult, UserContext } from "./AdminSupportTicketService";

/** Update ticket status, priority, assignee, and side effects. */
export async function updateAdminTicket(input: UpdateAdminTicketInput) {
  return runAdminTicketMutation("updateTicket", "Gagal mengupdate tiket", () =>
    performAdminTicketUpdate(input),
  );
}

async function performAdminTicketUpdate(input: UpdateAdminTicketInput) {
  const existing = await input.ticketRepo.findByIdBasic(input.id);
  if (!existing) return notFoundResult();
  if (isForbidden(existing, input.user, input.hasSiteRestriction)) {
    return forbiddenResult();
  }

  const updateData = buildTicketUpdateData(input.data, existing);
  const ticket = (await input.ticketRepo.updateAdmin(
    input.id,
    updateData,
  )) as UpdatedTicketRecord;
  await finalizeAdminTicketUpdate({ input, existing, ticket, updateData });
  return { success: true, data: ticket };
}

async function finalizeAdminTicketUpdate(input: {
  input: UpdateAdminTicketInput;
  existing: ExistingTicketRecord;
  ticket: UpdatedTicketRecord;
  updateData: Prisma.SupportTicketsUpdateInput;
}) {
  await runClosingSideEffects(input.input);
  logAdminTicketUpdate(input.input, input.updateData);
  await publishStatusChange(input.input, input.existing, input.ticket);
}

function logAdminTicketUpdate(
  input: UpdateAdminTicketInput,
  updateData: Prisma.SupportTicketsUpdateInput,
) {
  logAdminTicketActivity("UPDATE", input.user.id, input.id, {
    updates: updateData,
  });
}

/** Delete ticket and log activity. */
export async function deleteAdminTicket(input: DeleteAdminTicketInput) {
  return runAdminTicketMutation(
    "deleteTicket",
    "Gagal menghapus tiket",
    async () => {
      const ticket = await input.ticketRepo.findByIdBasic(input.id);
      if (!ticket) return notFoundResult();
      if (isForbidden(ticket, input.user, input.hasSiteRestriction))
        return forbiddenResult();

      await input.ticketRepo.delete(input.id);
      logAdminTicketActivity("DELETE", input.user.id, input.id, {});
      return { success: true, data: { id: input.id } };
    },
  );
}

async function runAdminTicketMutation<T>(
  operation: string,
  errorMessage: string,
  run: () => Promise<T>,
) {
  try {
    return await run();
  } catch (error) {
    logger.error(`[AdminSupportTicketService.${operation}] Error:`, error);
    if (isPrismaRecordNotFoundError(error)) return notFoundResult();
    return {
      success: false,
      error: errorMessage,
      code: "INTERNAL_ERROR",
    };
  }
}

function buildTicketUpdateData(
  data: UpdateAdminTicketData,
  existing: ExistingTicketRecord,
) {
  return {
    ...buildStatusUpdateData(data.status, existing),
    ...buildPriorityUpdateData(data.priority),
    ...buildAssigneeUpdateData(data.assignedToId),
  } as Prisma.SupportTicketsUpdateInput;
}

function buildStatusUpdateData(
  status: TicketStatus | undefined,
  existing: ExistingTicketRecord,
) {
  if (!status || !Object.values(TicketStatus).includes(status)) return {};
  return {
    status,
    ...(status === TicketStatus.RESOLVED && !existing.resolvedAt
      ? { resolvedAt: new Date() }
      : {}),
    ...(status === TicketStatus.CLOSED && !existing.closedAt
      ? { closedAt: new Date() }
      : {}),
  };
}

function buildPriorityUpdateData(priority?: TicketPriority) {
  return priority ? { priority } : {};
}

function buildAssigneeUpdateData(assignedToId?: string | null) {
  if (assignedToId === undefined) return {};
  return {
    user: assignedToId
      ? { connect: { id: assignedToId } }
      : { disconnect: true },
  };
}

async function runClosingSideEffects(input: UpdateAdminTicketInput) {
  if (input.data.status !== TicketStatus.CLOSED) return;
  if (input.data.closingNote) await createClosingReply(input);
  await closeWoOnTicketClose(input.id);
}

function createClosingReply(input: UpdateAdminTicketInput) {
  return input.ticketRepo.createReply({
    ticketId: input.id,
    message: input.data.closingNote || "",
    isFromAdmin: true,
    senderId: input.user.id,
  });
}

async function publishStatusChange(
  input: UpdateAdminTicketInput,
  existing: ExistingTicketRecord,
  ticket: UpdatedTicketRecord,
) {
  if (!input.data.status || input.data.status === existing.status) return;
  await TicketEventDispatcher.onStatusChanged({
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: existing.subject,
    priority: ticket.priority,
    pelangganNama: ticket.pelanggan?.nama,
    siteId: existing.pelanggan?.siteId,
    triggeredBy: input.user.id,
  }).catch((err) =>
    logger.error("Failed to publish TICKET_STATUS_CHANGED event:", err),
  );
}

function isForbidden(
  ticket: ExistingTicketRecord,
  user: UserContext,
  hasSiteRestriction: boolean,
) {
  return (
    hasSiteRestriction &&
    user.role !== "SUPER_ADMIN" &&
    (!user.siteId || ticket.pelanggan?.siteId !== user.siteId)
  );
}

function logAdminTicketActivity(
  action: string,
  userId: string,
  id: string,
  details: Record<string, unknown>,
) {
  logActivitySafe({
    action,
    subject: "Support Ticket",
    userId,
    details: { id, ...details },
  });
}

function notFoundResult(): ServiceResult<never> {
  return { success: false, error: "Tiket tidak ditemukan", code: "NOT_FOUND" };
}

function forbiddenResult(): ServiceResult<never> {
  return { success: false, error: "Akses ditolak", code: "FORBIDDEN" };
}

type UpdateAdminTicketInput = {
  id: string;
  data: UpdateAdminTicketData;
  user: UserContext;
  hasSiteRestriction: boolean;
  ticketRepo: ICustomerTicketRepository;
};

type DeleteAdminTicketInput = Omit<UpdateAdminTicketInput, "data">;

type UpdateAdminTicketData = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string | null;
  closingNote?: string;
};

type ExistingTicketRecord = {
  status: string;
  subject: string;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  pelanggan?: { siteId?: string | null; nama?: string | null } | null;
};

type UpdatedTicketRecord = {
  id: string;
  ticketNumber: string;
  priority: TicketPriority;
  pelanggan?: { nama?: string | null } | null;
};
