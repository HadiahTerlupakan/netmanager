import { describe, expect, it, vi } from "vitest";

import {
  fetchMock,
  mockIo,
  mockUseEffect,
  mockUseState,
  useRealtimeEventMock,
  useRealtimeScopeMock,
} from "./realtime-boundary-test-setup";

describe("realtime notifications announcements", () => {
  it("subscribes realtime notifications through normalized notification events", async () => {
    const { useRealtimeNotifications } =
      await import("@/lib/realtime/hooks/useRealtimeNotifications");

    useRealtimeNotifications();

    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "notification.new",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "notification.count",
      expect.any(Function),
    );
  });

  it("loads admin bell notifications from the list endpoint only on initial fetch", async () => {
    const { useRealtimeNotifications } =
      await import("@/lib/realtime/hooks/useRealtimeNotifications");

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        notifications: [],
        unreadCount: 4,
      }),
    });
    mockUseEffect.mockImplementation((effect: () => void | (() => void)) => {
      effect();
    });

    useRealtimeNotifications({ limit: 5, excludeTypes: ["WORK_ORDER"] });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications?limit=5&excludeTypes=WORK_ORDER&includeTotal=false",
    );
  });

  it("subscribes customer notifications through normalized announcement and ticket events", async () => {
    const { useCustomerNotifications } =
      await import("@/lib/websocket/hooks/useCustomerNotifications");

    useCustomerNotifications();

    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "announcement.new",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.message",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.reply",
      expect.any(Function),
    );
  });

  it("subscribes admin support tickets through site-scoped ticket streams", async () => {
    const { useRealtimeSupportTickets } =
      await import("@/lib/websocket/hooks/useRealtimeSupportTickets");

    useRealtimeSupportTickets();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "tickets.site.site-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.new",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.update",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.reply",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "ticket.count",
      expect.any(Function),
    );
  });

  it("subscribes payment approvals through normalized payment pending events", async () => {
    const { useRealtimePaymentApprovals } =
      await import("@/lib/websocket/hooks/useRealtimePaymentApprovals");

    useRealtimePaymentApprovals();

    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "payment.pending.new",
      expect.any(Function),
    );
  });

  it("subscribes workorder notifications through the site-scoped admin stream and normalized events", async () => {
    const { useRealtimeWorkOrders } =
      await import("@/lib/websocket/hooks/useRealtimeWorkOrders");

    useRealtimeWorkOrders();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "workorders.site.site-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "notification.new",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.activity",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.update",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.new",
      expect.any(Function),
    );
  });

  it("subscribes announcement popup through normalized realtime announcement events", async () => {
    const announcementPopupModule =
      await import("@/components/announcement/AnnouncementPopup");
    const AnnouncementPopup = announcementPopupModule.default;

    AnnouncementPopup({ portal: "customer" });

    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "announcement.new",
      expect.any(Function),
    );
    expect(mockIo).not.toHaveBeenCalled();
  });

  it("filters customer announcement popup payloads to customer audiences only", async () => {
    const announcementPopupModule =
      await import("@/components/announcement/AnnouncementPopup");
    const AnnouncementPopup = announcementPopupModule.default;
    const localStorageMock = window.localStorage;
    const setAnnouncements = vi.fn();

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    const setCurrentIndex = vi.fn();
    const setIsVisible = vi.fn();
    const setLoading = vi.fn();

    localStorageMock.getItem = vi.fn(() => "[]");
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });
    mockUseState
      .mockImplementationOnce(() => [[], setAnnouncements])
      .mockImplementationOnce(() => [0, setCurrentIndex])
      .mockImplementationOnce(() => [false, setIsVisible])
      .mockImplementationOnce(() => [true, setLoading]);

    AnnouncementPopup({ portal: "customer" });

    const announcementHandler = useRealtimeEventMock.mock.calls.find(
      ([eventName]) => eventName === "announcement.new",
    )?.[1] as
      | ((payload: {
          id: string;
          title: string;
          content: string;
          createdAt: string;
          target?: string;
          isPinned: boolean;
        }) => void)
      | undefined;

    expect(announcementHandler).toBeTypeOf("function");

    announcementHandler?.({
      id: "customer-announcement",
      title: "Info pelanggan",
      content: "Untuk pelanggan",
      createdAt: "2026-03-08T11:00:00.000Z",
      target: "CUSTOMER",
      isPinned: true,
    });

    expect(setAnnouncements).toHaveBeenCalledTimes(1);
    const updateAnnouncements = setAnnouncements.mock.calls[0]?.[0] as
      | ((items: Array<{ id: string }>) => Array<{ id: string }>)
      | undefined;
    expect(updateAnnouncements).toBeTypeOf("function");
    expect(updateAnnouncements?.([])).toEqual([
      expect.objectContaining({ id: "customer-announcement" }),
    ]);
    expect(setCurrentIndex).toHaveBeenCalledWith(0);
    expect(setIsVisible).toHaveBeenCalledWith(true);

    announcementHandler?.({
      id: "admin-announcement",
      title: "Info admin",
      content: "Untuk admin",
      createdAt: "2026-03-08T12:00:00.000Z",
      target: "ADMIN",
      isPinned: false,
    });

    expect(setAnnouncements).toHaveBeenCalledTimes(1);
    expect(setCurrentIndex).toHaveBeenCalledTimes(1);
    expect(setIsVisible).toHaveBeenCalledTimes(1);
  });
});
