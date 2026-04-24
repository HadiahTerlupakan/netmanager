import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  useFCM: vi.fn(),
  useRealtimeNotifications: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
      getSnapshot(),
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    className,
    disabled,
    onClick,
    title,
  }: {
    children?: ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    title?: string;
  }) => (
    <button
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/hooks/useFCM", () => ({
  useFCM: () => mockFns.useFCM(),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: () => mockFns.useRealtimeNotifications(),
}));

import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";
import { PushNotificationManager } from "@/components/notifications/PushNotificationManager";
import { PushNotificationProvider } from "@/components/notifications/PushNotificationContext";

function renderWithPushProvider(children: ReactNode) {
  return renderToStaticMarkup(
    <PushNotificationProvider>{children}</PushNotificationProvider>,
  );
}

describe("AdminNotificationBell push status icon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.useFCM.mockReturnValue({
      permission: "default",
      isSupported: true,
      isLoading: false,
      isRegistered: false,
      enableNotifications: vi.fn(),
    });
    mockFns.useRealtimeNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: false,
      isConnected: true,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refresh: vi.fn(),
      error: null,
    });
  });

  it("renders a solid bell when push notifications are active", () => {
    mockFns.useFCM.mockReturnValue({ isRegistered: true });

    const markup = renderWithPushProvider(<AdminNotificationBell />);

    expect(markup).toContain('data-testid="admin-push-bell-solid"');
    expect(markup).not.toContain('data-testid="admin-push-bell-outline"');
  });

  it("renders an outline bell when push notifications are inactive", () => {
    const markup = renderWithPushProvider(<AdminNotificationBell />);

    expect(markup).toContain('data-testid="admin-push-bell-outline"');
    expect(markup).not.toContain('data-testid="admin-push-bell-solid"');
  });

  it("preserves unread badge and realtime connection dot", () => {
    mockFns.useRealtimeNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 7,
      loading: false,
      isConnected: true,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refresh: vi.fn(),
      error: null,
    });

    const markup = renderWithPushProvider(<AdminNotificationBell />);

    expect(markup).toContain(">7</span>");
    expect(markup).toContain('title="Real-time connected"');
  });

  it("keeps the activation CTA when push notifications are not active", () => {
    const markup = renderWithPushProvider(<PushNotificationManager />);

    expect(markup).toContain("Aktifkan Notifikasi");
    expect(markup).toContain("Nanti saja");
  });

  it("shares one FCM state instance between the activation manager and navbar bell", () => {
    renderWithPushProvider(
      <>
        <PushNotificationManager />
        <AdminNotificationBell />
      </>,
    );

    expect(mockFns.useFCM).toHaveBeenCalledTimes(1);
  });
});
