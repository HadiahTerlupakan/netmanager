"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { type TicketPayload, type CountPayload } from "../types";
import { usePermission } from "@/hooks/use-permission";

export interface TicketPreview {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category?: string;
  createdAt: string;
  pelanggan: {
    nama: string;
    idPelanggan: string;
  };
  lastReply?: {
    isFromAdmin: boolean;
    createdAt: string;
  } | null;
}

interface AdminTicketSessionUser {
  primarySiteId?: string | null;
  siteIds?: string[];
  siteId?: string | null;
}

interface AdminTicketSession {
  user?: AdminTicketSessionUser;
}

interface UseRealtimeSupportTicketsOptions {
  limit?: number;
  autoFetch?: boolean;
  enabled?: boolean;
}

interface UseRealtimeSupportTicketsResult {
  tickets: TicketPreview[];
  unreadCount: number;
  loading: boolean;
  isConnected: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time support tickets with WebSocket
 */
export function useRealtimeSupportTickets(
  options: UseRealtimeSupportTicketsOptions = {},
): UseRealtimeSupportTicketsResult {
  const { limit = 5, autoFetch = true, enabled = true } = options;
  const { data: session } = useSession();
  const sessionUser = (session as AdminTicketSession | null)?.user;
  const { isConnected } = useRealtime();
  const { hasPermission, isLoading: isPermissionLoading } = usePermission();

  const [tickets, setTickets] = useState<TicketPreview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const lastCountRef = useRef(0);
  const canReadSupportTickets = hasPermission("support:read");
  const adminSiteId =
    sessionUser?.primarySiteId ||
    sessionUser?.siteIds?.[0] ||
    sessionUser?.siteId ||
    null;
  const adminTicketScope =
    enabled && !isPermissionLoading && canReadSupportTickets && adminSiteId
      ? { kind: "admin" as const, id: `tickets.site.${adminSiteId}` }
      : null;

  useRealtimeScope(adminTicketScope);

  const shouldHandleAdminTicketEvents = !!adminTicketScope;

  const fetchTickets = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (isPermissionLoading) {
      return;
    }

    if (!canReadSupportTickets) {
      setLoading(false);
      return;
    }

    try {
      const [countRes, listRes] = await Promise.all([
        fetch("/api/admin/support-tickets/unread-count"),
        fetch(`/api/admin/support-tickets?limit=${limit}`),
      ]);

      if (countRes.ok) {
        const data = await countRes.json();
        const newCount = data.count || 0;

        if (newCount > lastCountRef.current && lastCountRef.current > 0) {
          console.log("[Tickets] New ticket detected!");
        }

        lastCountRef.current = newCount;
        setUnreadCount(newCount);
      }

      if (listRes.ok) {
        const data = await listRes.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error("[Tickets] Error fetching:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, enabled, canReadSupportTickets, isPermissionLoading]);

  useEffect(() => {
    if (autoFetch && !isPermissionLoading && enabled) {
      void fetchTickets();
    }
  }, [autoFetch, fetchTickets, isPermissionLoading, enabled]);

  const playSound = useCallback(() => {
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.play().catch((_err) => console.log("Audio play failed:", _err));
    } catch (_error) {
      // Ignore audio errors
    }
  }, []);

  const handleNewTicket = useCallback(
    (payload: TicketPayload) => {
      if (!shouldHandleAdminTicketEvents) {
        return;
      }

      console.log("[Tickets] New ticket received:", payload.ticketNumber);
      playSound();
      void fetchTickets();
    },
    [fetchTickets, playSound, shouldHandleAdminTicketEvents],
  );

  const handleTicketUpdate = useCallback(
    (payload: TicketPayload) => {
      if (!shouldHandleAdminTicketEvents) {
        return;
      }

      console.log("[Tickets] Ticket updated:", payload.ticketNumber);
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === payload.id
            ? {
                ...ticket,
                status: payload.status,
                priority: payload.priority,
              }
            : ticket,
        ),
      );
    },
    [shouldHandleAdminTicketEvents],
  );

  const handleTicketReply = useCallback(
    (payload: TicketPayload) => {
      if (!shouldHandleAdminTicketEvents) {
        return;
      }

      console.log("[Tickets] Ticket reply:", payload.ticketNumber);
      playSound();
      void fetchTickets();
    },
    [fetchTickets, playSound, shouldHandleAdminTicketEvents],
  );

  const handleCountUpdate = useCallback(
    (payload: CountPayload) => {
      if (!shouldHandleAdminTicketEvents) {
        return;
      }

      setUnreadCount(payload.count);
      lastCountRef.current = payload.count;
    },
    [shouldHandleAdminTicketEvents],
  );

  useRealtimeEvent<TicketPayload>("ticket.new", handleNewTicket);
  useRealtimeEvent<TicketPayload>("ticket.update", handleTicketUpdate);
  useRealtimeEvent<TicketPayload>("ticket.reply", handleTicketReply);
  useRealtimeEvent<CountPayload>("ticket.count", handleCountUpdate);

  return {
    tickets,
    unreadCount,
    loading,
    isConnected,
    refresh: fetchTickets,
  };
}
