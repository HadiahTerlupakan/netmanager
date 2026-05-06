"use client";

import { useState, useEffect, useCallback } from "react";
import { HiXMark, HiMegaphone } from "react-icons/hi2";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { clientLogger } from "@/lib/client-logger";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  target?: string;
}

interface AnnouncementPopupProps {
  portal: "customer" | "employee";
}

export default function AnnouncementPopup({ portal }: AnnouncementPopupProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Handle new announcement from WebSocket
  const handleNewAnnouncement = useCallback(
    (data: Announcement) => {
      // Check if this announcement is for this portal
      const targetMap = {
        customer: ["ALL", "CUSTOMER"],
        employee: ["ALL", "EMPLOYEE"],
      };

      if (!data.target || targetMap[portal].includes(data.target)) {
        // Check if already dismissed
        const dismissedIds = JSON.parse(
          localStorage.getItem(`dismissed_announcements_${portal}`) || "[]",
        );
        if (!dismissedIds.includes(data.id)) {
          setAnnouncements((prev) => {
            // Avoid duplicates
            if (prev.some((a) => a.id === data.id)) return prev;
            return [data, ...prev];
          });
          setCurrentIndex(0);
          setIsVisible(true);
        }
      }
    },
    [portal],
  );

  useRealtimeEvent("announcement.new", handleNewAnnouncement);

  // Fetch existing announcements on mount
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(
          `/api/announcements?portal=${portal}&active=true`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            const activeIds = data.map((ann: Announcement) => ann.id);
            const dismissedIds: string[] = JSON.parse(
              localStorage.getItem(`dismissed_announcements_${portal}`) || "[]",
            );
            const validDismissedIds = dismissedIds.filter((id: string) =>
              activeIds.includes(id),
            );

            if (validDismissedIds.length !== dismissedIds.length) {
              localStorage.setItem(
                `dismissed_announcements_${portal}`,
                JSON.stringify(validDismissedIds),
              );
            }

            const newAnnouncements = data.filter(
              (ann: Announcement) => !validDismissedIds.includes(ann.id),
            );

            if (newAnnouncements.length > 0) {
              setAnnouncements(newAnnouncements);
              setIsVisible(true);
            }
          }
        }
      } catch (_error) {
        clientLogger.error("Failed to fetch announcements", _error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchAnnouncements, 100);
    return () => clearTimeout(timer);
  }, [portal]);

  const handleDismiss = async () => {
    // Store dismissed announcement IDs
    const currentAnn = announcements[currentIndex];

    // Safety check - if currentAnn is undefined, just close
    if (!currentAnn) {
      setIsVisible(false);
      return;
    }

    const dismissedIds = JSON.parse(
      localStorage.getItem(`dismissed_announcements_${portal}`) || "[]",
    );
    if (!dismissedIds.includes(currentAnn.id)) {
      dismissedIds.push(currentAnn.id);
      localStorage.setItem(
        `dismissed_announcements_${portal}`,
        JSON.stringify(dismissedIds),
      );
    }

    // Mark as read in backend (fire and forget)
    try {
      const readUrl =
        portal === "customer"
          ? `/api/customer/announcements/${currentAnn.id}/read`
          : `/api/announcements/${currentAnn.id}/read`;
      fetch(readUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal }),
      }).catch(() => {
        /* ignore errors */
      });
    } catch {
      // Ignore errors - this is non-critical
    }

    if (currentIndex < announcements.length - 1) {
      // Show next announcement
      setCurrentIndex((prev) => prev + 1);
    } else {
      // No more announcements, hide popup
      setIsVisible(false);
    }
  };

  const handleDismissAll = () => {
    // Store all announcement IDs as dismissed
    const dismissedIds = announcements.map((ann) => ann.id);
    localStorage.setItem(
      `dismissed_announcements_${portal}`,
      JSON.stringify(dismissedIds),
    );

    // Mark all as read in backend (fire and forget)
    announcements.forEach((ann) => {
      try {
        const readUrl =
          portal === "customer"
            ? `/api/customer/announcements/${ann.id}/read`
            : `/api/announcements/${ann.id}/read`;
        fetch(readUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portal }),
        }).catch(() => {
          /* ignore errors */
        });
      } catch {
        // Ignore errors
      }
    });

    setIsVisible(false);
  };

  if (loading || !isVisible || announcements.length === 0) {
    return null;
  }

  const current = announcements[currentIndex];

  // Safety check - if current is undefined, don't render
  if (!current) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <HiMegaphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Pengumuman</h2>
                {announcements.length > 1 && (
                  <p className="text-xs text-white/80">
                    {currentIndex + 1} dari {announcements.length}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={handleDismiss}>
              <HiXMark className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {current.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-wrap">
            {current.content}
          </p>
          <p className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(current.createdAt), {
              addSuffix: true,
              locale: id,
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <Button onClick={handleDismissAll}>Tutup Semua</Button>
            <Button onClick={handleDismiss}>
              {currentIndex < announcements.length - 1
                ? "Berikutnya"
                : "Mengerti"}
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
