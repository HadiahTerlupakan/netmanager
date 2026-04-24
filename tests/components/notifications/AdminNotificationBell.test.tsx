import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const bellMocks = vi.hoisted(() => ({
  useRealtimeNotifications: vi.fn(),
  useClickOutside: vi.fn(),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: bellMocks.useRealtimeNotifications,
}));

vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: bellMocks.useClickOutside,
}));

import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";

describe("AdminNotificationBell", () => {
  it("shows a loading state instead of an empty state while notifications load", () => {
    bellMocks.useRealtimeNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: true,
      error: null,
      isConnected: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refresh: vi.fn(),
    });

    const markup = renderToStaticMarkup(<AdminNotificationBell defaultOpen />);

    expect(markup).toContain("Memuat notifikasi");
    expect(markup).not.toContain("Tidak ada notifikasi");
  });

  it("shows retry copy when notifications fail to load", () => {
    bellMocks.useRealtimeNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: "Gagal mengambil notifikasi",
      isConnected: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refresh: vi.fn(),
    });

    const markup = renderToStaticMarkup(<AdminNotificationBell defaultOpen />);

    expect(markup).toContain("Gagal memuat notifikasi");
    expect(markup).toContain("Coba lagi");
  });
});
