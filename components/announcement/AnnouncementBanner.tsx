"use client";

import { useState, useEffect } from "react";
import { HiXMark, HiMegaphone } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
}

interface AnnouncementBannerProps {
  portal: "admin" | "customer" | "employee";
}

export default function AnnouncementBanner({
  portal,
}: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Fetch active announcements for this portal
        const res = await fetch(
          `/api/announcements?portal=${portal}&active=true`,
        );
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data);
        }
      } catch (error) {
        clientLogger.error("Failed to fetch announcements", error);
      }
    };

    fetchAnnouncements();
  }, [portal]);

  const handleDismiss = () => {
    // Mark current announcement as read (fire and forget)
    const current = announcements[currentIndex];
    if (current) {
      fetch(`/api/announcements/${current.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal }),
      }).catch(() => {
        /* ignore errors */
      });
    }
    setIsVisible(false);
  };

  if (!isVisible || announcements.length === 0) return null;

  const current = announcements[currentIndex];

  // Safety check - if current is undefined, don't render
  if (!current) return null;

  // Auto rotate if multiple
  // useEffect(() => { ... }, [currentIndex, announcements.length]);

  return (
    <div className="bg-indigo-600 text-white px-4 py-3 relative shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <span className="flex p-2 rounded-lg bg-indigo-800">
            <HiMegaphone className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <div className="ml-3 font-medium truncate">
            <span className="md:hidden">{current.title}</span>
            <span className="hidden md:inline">
              <span className="font-bold mr-2">{current.title}:</span>
              {current.content}
            </span>
          </div>
        </div>
        <div className="shrink-0 sm:ml-3 flex items-center">
          {announcements.length > 1 && (
            <div className="flex space-x-2 mr-4 text-sm">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setCurrentIndex(
                    (prev) =>
                      (prev - 1 + announcements.length) % announcements.length,
                  )
                }
                className="text-white hover:bg-white/10"
              >
                &lt;
              </Button>
              <span>
                {currentIndex + 1}/{announcements.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setCurrentIndex((prev) => (prev + 1) % announcements.length)
                }
                className="text-white hover:bg-white/10"
              >
                &gt;
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            className="-mr-1 text-white hover:bg-white/10"
            onClick={handleDismiss}
          >
            <span className="sr-only">Dismiss</span>
            <HiXMark className="h-6 w-6 text-white" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
