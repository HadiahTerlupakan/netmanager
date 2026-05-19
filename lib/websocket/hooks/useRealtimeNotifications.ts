"use client";
import { clientLogger } from "@/lib/client-logger";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { type NotificationPayload, type CountPayload } from "../types";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { addUnreadRealtimeNotification } from "@/lib/realtime/notification-state";

export interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

async function buildNotificationFetchError(response: Response) {
  const responseBody = await response.text().catch(() => "");

  return new Error(
    `Gagal mengambil notifikasi: ${response.url} ${response.status} ${responseBody}`,
  );
}

interface UseRealtimeNotificationsOptions {
  limit?: number;
  autoFetch?: boolean;
  excludeTypes?: string[]; // e.g., ['WORK_ORDER'] to exclude from general notifications
}

interface UseRealtimeNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications(
  options: UseRealtimeNotificationsOptions = {},
): UseRealtimeNotificationsResult {
  const { limit = 5, autoFetch = true, excludeTypes = [] } = options;
  const { isConnected } = useRealtime();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // Stabilize excludeTypes array reference using JSON comparison
  const excludeTypesKey = JSON.stringify(excludeTypes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableExcludeTypes = useMemo(() => excludeTypes, [excludeTypesKey]);

  // Build query params with stable reference
  const excludeParam = useMemo(
    () =>
      stableExcludeTypes.length > 0
        ? `&excludeTypes=${stableExcludeTypes.join(",")}`
        : "",
    [stableExcludeTypes],
  );

  // Fetch notifications from API - only once on mount
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const listRes = await fetch(
        `/api/notifications?limit=${limit}${excludeParam}&includeTotal=false`,
      );

      if (!listRes.ok) {
        throw await buildNotificationFetchError(listRes);
      }

      const listData = await listRes.json();
      setUnreadCount(listData.unreadCount || 0);
      setNotifications(listData.notifications || []);
    } catch (error) {
      clientLogger.error("[Notifications] Error fetching:", error);
      setError("Gagal mengambil notifikasi");
    } finally {
      setLoading(false);
    }
  }, [limit, excludeParam]);

  // Initial fetch - only once on mount (pattern E)
  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchNotifications();
  }, [autoFetch, fetchNotifications]);

  // Handle new notification from WebSocket
  const handleNewNotification = useCallback(
    (payload: NotificationPayload) => {
      // Skip if this type is excluded
      if (stableExcludeTypes.includes(payload.type)) {
        return;
      }

      clientLogger.info(
        "[Notifications] New notification received:",
        payload.title,
      );

      // Play notification sound based on settings
      try {
        const soundEnabled =
          localStorage.getItem("chat_sound_enabled") !== "false";

        if (soundEnabled) {
          const soundType = localStorage.getItem("chat_sound_type");
          const customData = localStorage.getItem("chat_custom_sound_data");

          let audioSrc = "/sounds/notification.mp3";
          if (soundType === "custom" && customData) {
            audioSrc = customData;
          }

          const audio = new Audio(audioSrc);
          audio
            .play()
            .catch((_err) => clientLogger.info("Audio play failed:", _err));
        }
      } catch (_error) {
        // Ignore audio errors
      }

      setNotifications((prev) => {
        const result = addUnreadRealtimeNotification(prev, payload, limit);
        if (result.didAdd) {
          setUnreadCount((count) => count + 1);
        }
        return result.notifications;
      });
    },
    [limit, stableExcludeTypes],
  );

  // Handle count update from WebSocket
  const handleCountUpdate = useCallback((payload: CountPayload) => {
    setUnreadCount(payload.count);
  }, []);

  useRealtimeEvent("notification.new", handleNewNotification);
  useRealtimeEvent("notification.count", handleCountUpdate);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      clientLogger.error("[Notifications] Error marking as read:", error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      clientLogger.error("[Notifications] Error marking all as read:", error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    isConnected,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
