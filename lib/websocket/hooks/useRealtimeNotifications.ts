"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSocket } from "../SocketContext";
import { type NotificationPayload, type CountPayload } from "../types";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";

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

interface UseRealtimeNotificationsOptions {
  limit?: number;
  autoFetch?: boolean;
  excludeTypes?: string[]; // e.g., ['WORK_ORDER'] to exclude from general notifications
}

interface UseRealtimeNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  isConnected: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time notifications with WebSocket
 */
export function useRealtimeNotifications(
  options: UseRealtimeNotificationsOptions = {},
): UseRealtimeNotificationsResult {
  const { limit = 5, autoFetch = true, excludeTypes = [] } = options;
  const { isConnected } = useSocket();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

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
      const [countRes, listRes] = await Promise.all([
        fetch(
          `/api/notifications/unread-count${excludeParam ? `?excludeTypes=${stableExcludeTypes.join(",")}` : ""}`,
        ),
        fetch(`/api/notifications?limit=${limit}${excludeParam}`),
      ]);

      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(data.count || 0);
      }

      if (listRes.ok) {
        const data = await listRes.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("[Notifications] Error fetching:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, excludeParam, stableExcludeTypes]);

  // Initial fetch - only once on mount
  useEffect(() => {
    if (autoFetch && !hasFetched) {
      setHasFetched(true);
      fetchNotifications();
    }
  }, [autoFetch, hasFetched, fetchNotifications]);

  // Handle new notification from WebSocket
  const handleNewNotification = useCallback(
    (payload: NotificationPayload) => {
      // Skip if this type is excluded
      if (stableExcludeTypes.includes(payload.type)) {
        return;
      }

      console.log("[Notifications] New notification received:", payload.title);

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
          audio.play().catch((_err) => console.log("Audio play failed:", _err));
        }
      } catch (_error) {
        // Ignore audio errors
      }

      // Add to beginning of list
      setNotifications((prev) => {
        const { link, ...restPayload } = payload;
        const newNotification: Notification = {
          ...restPayload,
          ...(link ? { link } : {}),
          isRead: false,
        };
        return [newNotification, ...prev.slice(0, limit - 1)];
      });

      // Increment unread count
      setUnreadCount((prev) => prev + 1);
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
      console.error("[Notifications] Error marking as read:", error);
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
      console.error("[Notifications] Error marking all as read:", error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
