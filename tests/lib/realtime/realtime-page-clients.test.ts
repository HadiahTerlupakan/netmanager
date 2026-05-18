import { describe, expect, it, vi } from "vitest";

import {
  mockUsePermission,
  mockUseRef,
  mockUseState,
  useRealtimeEventMock,
  useRealtimeScopeMock,
} from "./realtime-boundary-test-setup";

// Untuk LiveMap, sumber tenantId sekarang dari useApi (bukan useState).
// Override mock useApi default agar return data berisi tenantId saat test
// LiveMap, fallback ke default mock untuk test lain.
import { useApi as useApiMock } from "@/lib/hooks/useApi";

describe("realtime page clients", () => {
  it("subscribes live map through realtime scope and event boundaries", async () => {
    const setSearchQuery = vi.fn();
    const setLastUpdated = vi.fn();
    const setViewMode = vi.fn();

    // useState order setelah migrasi: searchQuery, lastUpdated, viewMode.
    mockUseState
      .mockReturnValueOnce(["", setSearchQuery])
      .mockReturnValueOnce([null, setLastUpdated])
      .mockReturnValueOnce(["map", setViewMode]);

    // tenantId sekarang dari useApi data, bukan useState.
    (useApiMock as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      data: {
        locations: [],
        tenantId: "tenant-1",
      },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    });

    const liveMapModule =
      await import("@/app/admin/kehadiran/live-map/LiveMapClient");
    const LiveMapClient = liveMapModule.default;

    LiveMapClient();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "location:tenant-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "admin.location.update",
      expect.any(Function),
    );
  });

  it("subscribes chat page through the realtime event boundary instead of raw socket listeners", async () => {
    mockUseState
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce([false, vi.fn()]);

    mockUseRef
      .mockReturnValueOnce({ current: { scrollIntoView: vi.fn() } })
      .mockReturnValueOnce({ current: null });

    const chatPageModule = await import("@/app/admin/chat/ChatPageClient");
    const ChatPageClient = chatPageModule.default;

    ChatPageClient();

    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "chat.message",
      expect.any(Function),
    );
  });

  it("subscribes the workorder dashboard through the site-scoped admin stream and normalized events", async () => {
    const workordersIndexModule =
      await import("@/app/admin/workorders/WoIndexClient");

    workordersIndexModule.ClientComponent();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "workorders.site.site-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.new",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.update",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.assigned",
      expect.any(Function),
    );
  });

  it("subscribes the workorder detail page through realtime scope and event boundaries", async () => {
    const workorderDetailModule =
      await import("@/app/admin/workorders/[id]/WoDetailClient");

    workorderDetailModule.ClientComponent();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "workorder",
      id: "wo-1",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.activity",
      expect.any(Function),
    );
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "workorder.update",
      expect.any(Function),
    );
  });

  it("subscribes the mikrotik dashboard refresher through realtime scope and normalized events", async () => {
    const dashboardSocketModule =
      await import("@/components/dashboard/DashboardSocketUpdate");

    dashboardSocketModule.DashboardSocketUpdate();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "mikrotik",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "mikrotik.update",
      expect.any(Function),
    );
  });

  it("does not subscribe the dashboard refresher to mikrotik scope without mikrotik permission", async () => {
    mockUsePermission.mockReturnValue({
      hasPermission: vi.fn(() => false),
    });

    const dashboardSocketModule =
      await import("@/components/dashboard/DashboardSocketUpdate");

    dashboardSocketModule.DashboardSocketUpdate();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith(null);
  });

  it("subscribes the mikrotik router list through realtime scope and normalized events", async () => {
    const { useMikrotikRouterList } =
      await import("@/app/admin/network/mikrotik/hooks/useMikrotikRouterList");

    useMikrotikRouterList();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "mikrotik",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "mikrotik.update",
      expect.any(Function),
    );
  });
});
