import { describe, expect, it, vi } from "vitest";

import { RadiusDashboardService } from "@/modules/network";

describe("RadiusDashboardService", () => {
  it("returns stable stats contract from repository", async () => {
    const repository = {
      getDashboardStats: vi.fn().mockResolvedValue({
        totalUsers: 24,
        onlineUsers: 9,
        offlineUsers: 15,
        totalTrafficToday: {
          download: "1048576",
          upload: "524288",
          downloadGB: 1,
          uploadGB: 0.5,
        },
        lastSyncTime: "2026-04-12T00:00:00.000Z",
        lastSyncStats: {
          created: 2,
          updated: 3,
          deleted: 1,
        },
      }),
      getRecentSessions: vi.fn(),
      getTotalUsageByUsernames: vi.fn(),
    };

    const service = new RadiusDashboardService(repository as never);

    const result = await service.getStats({ tenantId: "tenant-1" });

    expect(result).toEqual({
      totalUsers: 24,
      onlineUsers: 9,
      offlineUsers: 15,
      totalTrafficToday: {
        download: "1048576",
        upload: "524288",
        downloadGB: 1,
        uploadGB: 0.5,
      },
      lastSyncTime: "2026-04-12T00:00:00.000Z",
      lastSyncStats: {
        created: 2,
        updated: 3,
        deleted: 1,
      },
    });
    expect(repository.getDashboardStats).toHaveBeenCalledWith("tenant-1");
  });

  it("rounds totalUsageGB only once for recent sessions", async () => {
    const repository = {
      getDashboardStats: vi.fn(),
      getRecentSessions: vi.fn().mockResolvedValue({
        sessions: [
          {
            radAcctId: "1001",
            username: "alice",
            nasIpAddress: "10.0.0.1",
            framedIpAddress: "172.16.0.10",
            acctStartTime: "2026-04-12T08:00:00.000Z",
            uptimeHours: 2.5,
            downloadMB: 12.34,
            uploadMB: 5.67,
            isOnline: true,
          },
          {
            radAcctId: "1002",
            username: "bob",
            nasIpAddress: "10.0.0.2",
            framedIpAddress: null,
            acctStartTime: "2026-04-12T07:00:00.000Z",
            uptimeHours: 3,
            downloadMB: 7.89,
            uploadMB: 1.23,
            isOnline: false,
          },
        ],
        total: 2,
      }),
      getTotalUsageByUsernames: vi.fn().mockResolvedValue({
        alice: { downloadMB: 20.25, uploadMB: 10.25 },
        bob: { downloadMB: 9.75, uploadMB: 3.5 },
      }),
    };

    const service = new RadiusDashboardService(repository as never);

    const result = await service.getRecentSessions({
      tenantId: "tenant-1",
      page: 2,
      limit: 25,
      status: "active",
    });

    expect(result).toEqual({
      sessions: [
        {
          radAcctId: "1001",
          username: "alice",
          nasIpAddress: "10.0.0.1",
          framedIpAddress: "172.16.0.10",
          acctStartTime: "2026-04-12T08:00:00.000Z",
          uptimeHours: 2.5,
          downloadMB: 12.34,
          uploadMB: 5.67,
          isOnline: true,
          totalUsageGB: 0.03,
        },
        {
          radAcctId: "1002",
          username: "bob",
          nasIpAddress: "10.0.0.2",
          framedIpAddress: null,
          acctStartTime: "2026-04-12T07:00:00.000Z",
          uptimeHours: 3,
          downloadMB: 7.89,
          uploadMB: 1.23,
          isOnline: false,
          totalUsageGB: 0.01,
        },
      ],
      pagination: {
        page: 2,
        limit: 25,
        total: 2,
        totalPages: 1,
      },
    });

    expect(repository.getRecentSessions).toHaveBeenCalledWith("tenant-1", {
      page: 2,
      limit: 25,
      status: "active",
    });
    expect(repository.getTotalUsageByUsernames).toHaveBeenCalledWith(
      "tenant-1",
      ["alice", "bob"],
    );
  });
});
