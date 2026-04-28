"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MdNotifications, MdWork, MdInventory } from "react-icons/md";
import { HiMegaphone } from "react-icons/hi2";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useRealtimeNotifications } from "@/lib/realtime/hooks/useRealtimeNotifications";
import { usePermission } from "@/hooks/use-permission";
import { useClickOutside } from "@/hooks/useClickOutside";
import { normalizeKaryawanNotificationLink } from "@/lib/notifications/normalizeKaryawanNotificationLink";
import { clientLogger } from "@/lib/client-logger";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

export function KaryawanNotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    markAsRead,
    markAllAsRead,
  } = useRealtimeNotifications({ limit: 10 });
  const { hasPermission } = usePermission();
  const canViewNotifications = hasPermission("k_notification:read");

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [_announcementsLoading, setAnnouncementsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(
          "/api/announcements?portal=employee&active=true",
        );
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data);
        }
      } catch (_error) {
        clientLogger.error("Failed to fetch announcements", _error);
      } finally {
        setAnnouncementsLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const handleMarkAllAsRead = async () => {
    setIsLoading(true);
    try {
      await markAllAsRead();
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "WORK_ORDER":
        return <MdWork className="text-blue-500" />;
      default:
        return <MdInventory className="text-gray-500" />;
    }
  };

  const totalCount = unreadCount + announcements.length;

  if (!canViewNotifications) {
    return (
      <Button
        disabled
        className="relative"
        title="Anda tidak memiliki akses notifikasi"
      >
        <MdNotifications className="text-2xl" />
      </Button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-full size-10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative"
      >
        <MdNotifications className="text-2xl text-blue-600 dark:text-white" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
        {/* WebSocket connection indicator */}
        {isConnected && (
          <span
            className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"
            title="Real-time connected"
          />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 max-h-[70vh] bg-white dark:bg-[#1c2936] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white">
                Notifikasi
              </h3>
              {isConnected && (
                <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                  Live
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead} disabled={isLoading}>
                Tandai semua dibaca
              </Button>
            )}
          </div>

          {/* Announcements Section */}
          {announcements.length > 0 && (
            <div className="border-b border-gray-100 dark:border-gray-800">
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <HiMegaphone className="w-3 h-3" /> Pengumuman
                </span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {announcements.slice(0, 3).map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 bg-indigo-50/30 dark:bg-indigo-900/10"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                        <HiMegaphone className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {ann.title}
                        </span>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {ann.content}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatTime(ann.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="py-8 px-4 text-center text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm">Memuat...</p>
              </div>
            ) : notifications.length === 0 && announcements.length === 0 ? (
              <div className="py-8 px-4 text-center text-gray-500">
                <MdNotifications className="text-4xl mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada notifikasi</p>
              </div>
            ) : notifications.length === 0 ? null : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    !notif.isRead ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  <Link
                    href={normalizeKaryawanNotificationLink(notif.link)}
                    onClick={() => {
                      if (!notif.isRead) markAsRead(notif.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            !notif.isRead
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                      )}
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
