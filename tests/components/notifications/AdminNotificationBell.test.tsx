import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const bellMocks = vi.hoisted(() => ({
  useFCM: vi.fn(),
  useRealtimeNotifications: vi.fn(),
  useClickOutside: vi.fn(),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: bellMocks.useRealtimeNotifications,
}));

vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: bellMocks.useClickOutside,
}));

vi.mock("@/hooks/useFCM", () => ({
  useFCM: () => bellMocks.useFCM(),
}));

import { PushNotificationProvider } from "@/components/notifications/PushNotificationContext";
import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";

function renderAdminNotificationBell() {
  return renderToStaticMarkup(
    <PushNotificationProvider>
      <AdminNotificationBell defaultOpen />
    </PushNotificationProvider>,
  );
}

describe("AdminNotificationBell", () => {
  beforeEach(() => {
    bellMocks.useFCM.mockReturnValue({
      permission: "default",
      isSupported: true,
      isLoading: false,
      isRegistered: false,
      enableNotifications: vi.fn(),
    });
  });

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

    const markup = renderAdminNotificationBell();

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

    const markup = renderAdminNotificationBell();

    expect(markup).toContain("Gagal memuat notifikasi");
    expect(markup).toContain("Coba lagi");
  });
});
