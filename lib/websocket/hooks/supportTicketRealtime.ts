import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

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
