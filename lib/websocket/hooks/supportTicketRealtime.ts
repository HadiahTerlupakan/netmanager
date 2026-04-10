import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

export const SUPPORT_TICKET_REFETCH_EVENTS = [
  "ticket.new",
  "ticket.reply",
  "ticket.message",
] as const;

export function shouldRefetchSupportTickets(eventName: string): boolean {
  return SUPPORT_TICKET_REFETCH_EVENTS.includes(
    eventName as (typeof SUPPORT_TICKET_REFETCH_EVENTS)[number],
  );
}

export function useSupportTicketRealtime(
  ticketId: string | null | undefined,
  onRefresh: () => void,
): void {
  useRealtimeScope(ticketId ? { kind: "ticket", id: ticketId } : null);

  useRealtimeEvent(
    "ticket.message",
    (payload: { ticketId?: string } | null | undefined) => {
      if (!ticketId || payload?.ticketId !== ticketId) {
        return;
      }

      onRefresh();
    },
  );
}
