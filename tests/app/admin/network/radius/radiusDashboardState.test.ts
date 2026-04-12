import { describe, expect, it, vi } from "vitest";

import type { RadiusRecentSessionViewModel } from "@/modules/network/services/dashboard/radius-dashboard.contracts";

import {
  applyRealtimeSessionsUpdate,
  applyRealtimeStatsUpdate,
  createInitialRadiusDashboardState,
  refreshRadiusDashboardState,
} from "@/app/admin/network/radius/lib/radiusDashboardState";

describe("radiusDashboardState", () => {
  it("refreshRadiusDashboardState mengisi stats dan sessions serta menghapus error", async () => {
    const previousState = {
      ...createInitialRadiusDashboardState(),
      stats: {
        totalUsers: 2,
        onlineUsers: 1,
        offlineUsers: 1,
        totalTrafficToday: {
          download: "10 MB",
          upload: "5 MB",
          downloadGB: 0.01,
          uploadGB: 0.005,
        },
        lastSyncTime: "2026-04-12T00:00:00.000Z",
        lastSyncStats: { created: 1, updated: 0, deleted: 0 },
      },
      sessions: [buildRadiusSession("old", "old-user")],
    };

    const api = {
      getStats: vi.fn().mockResolvedValue({
        totalUsers: 10,
        onlineUsers: 4,
        offlineUsers: 6,
        totalTrafficToday: {
          download: "100 MB",
          upload: "50 MB",
          downloadGB: 0.1,
          uploadGB: 0.05,
        },
        lastSyncTime: "2026-04-12T01:00:00.000Z",
        lastSyncStats: { created: 2, updated: 3, deleted: 1 },
      }),
      getRecentSessions: vi.fn().mockResolvedValue({
        sessions: [{ radAcctId: "new", username: "new-user" }],
      }),
    };

    const nextState = await refreshRadiusDashboardState(previousState, api);

    expect(nextState.dashboardError).toBeNull();
    expect(nextState.stats).toEqual({
      totalUsers: 10,
      onlineUsers: 4,
      offlineUsers: 6,
      totalTrafficToday: {
        download: "100 MB",
        upload: "50 MB",
        downloadGB: 0.1,
        uploadGB: 0.05,
      },
      lastSyncTime: "2026-04-12T01:00:00.000Z",
      lastSyncStats: { created: 2, updated: 3, deleted: 1 },
    });
    expect(nextState.sessions).toEqual([
      { radAcctId: "new", username: "new-user" },
    ]);
    expect(nextState.loading).toBe(false);
    expect(nextState.refreshing).toBe(false);
  });

  it("refreshRadiusDashboardState mempertahankan data lama saat refresh gagal", async () => {
    const previousState = {
      ...createInitialRadiusDashboardState(),
      stats: {
        totalUsers: 7,
        onlineUsers: 3,
        offlineUsers: 4,
        totalTrafficToday: {
          download: "70 MB",
          upload: "35 MB",
          downloadGB: 0.07,
          uploadGB: 0.035,
        },
        lastSyncTime: "2026-04-12T00:30:00.000Z",
        lastSyncStats: { created: 1, updated: 1, deleted: 0 },
      },
      sessions: [buildRadiusSession("stable", "stable-user")],
    };

    const api = {
      getStats: vi.fn().mockRejectedValue(new Error("server down")),
      getRecentSessions: vi.fn(),
    };

    const nextState = await refreshRadiusDashboardState(previousState, api);

    expect(nextState.stats).toEqual(previousState.stats);
    expect(nextState.sessions).toEqual(previousState.sessions);
    expect(nextState.dashboardError).toBe("server down");
    expect(nextState.loading).toBe(false);
    expect(nextState.refreshing).toBe(false);
  });

  it("applyRealtime helpers mengganti stats dan sessions sesuai payload", () => {
    const withStats = applyRealtimeStatsUpdate(
      createInitialRadiusDashboardState(),
      {
        totalUsers: 8,
        onlineUsers: 5,
        offlineUsers: 3,
        totalTrafficToday: {
          download: "80 MB",
          upload: "40 MB",
          downloadGB: 0.08,
          uploadGB: 0.04,
        },
        lastSyncTime: "2026-04-12T02:00:00.000Z",
        lastSyncStats: { created: 4, updated: 1, deleted: 0 },
      },
    );

    const withSessions = applyRealtimeSessionsUpdate(withStats, {
      sessions: [
        buildRadiusSession("session-1", "user-a"),
        buildRadiusSession("session-2", "user-b"),
      ],
    });

    expect(withStats.stats?.totalUsers).toBe(8);
    expect(withSessions.sessions).toEqual([
      buildRadiusSession("session-1", "user-a"),
      buildRadiusSession("session-2", "user-b"),
    ]);
  });
});

function buildRadiusSession(
  radAcctId: string,
  username: string,
): RadiusRecentSessionViewModel {
  return {
    radAcctId,
    username,
    nasIpAddress: "10.0.0.1",
    framedIpAddress: "100.64.0.1",
    acctStartTime: "2026-04-12T00:00:00.000Z",
    acctStopTime: null,
    acctSessionTime: "3600",
    acctInputOctets: "1024",
    acctOutputOctets: "2048",
    uptimeSeconds: 3600,
    uptimeHours: 1,
    downloadMB: 2,
    uploadMB: 1,
    isOnline: true,
    totalUsageGB: 0.003,
  };
}
