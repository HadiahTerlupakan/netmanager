import { describe, expect, it, vi } from "vitest";

import { SystemLogRouteService } from "@/modules/admin/services/SystemLogRouteService";
import type { ISystemLogRepository } from "@/modules/admin/domain/ports/ISystemLogRepository";

const createdAt = new Date("2026-04-27T08:00:00.000Z");

function createRepository(): ISystemLogRepository {
  return {
    findAll: vi.fn().mockResolvedValue({
      data: [
        {
          id: "log-1",
          type: "SYSTEM",
          action: "LOGIN",
          subject: "AUTH",
          details: null,
          createdAt,
          user: { id: "user-1", name: "Budi", email: "budi@example.com" },
          request: { ipAddress: "127.0.0.1", userAgent: "Vitest" },
        },
      ],
      total: 1,
    }),
    findById: vi.fn(),
    getRecentActivity: vi.fn(),
    getStatsByAction: vi.fn(),
    getStatsBySubject: vi.fn(),
    count: vi.fn(),
  };
}

describe("SystemLogRouteService", () => {
  it("mengambil log melalui repository dengan filter dan pagination", async () => {
    const repository = createRepository();
    const service = new SystemLogRouteService(repository);

    const result = await service.getLogs({
      typeKey: "SYSTEM",
      action: "LOGIN",
      search: "budi",
      page: 2,
      limit: 10,
      requestedSiteId: "site-1",
    });

    expect(repository.findAll).toHaveBeenCalledWith({
      type: "SYSTEM",
      action: "LOGIN",
      search: "budi",
      skip: 10,
      take: 10,
      userSiteIds: ["site-1"],
    });
    expect(result).toEqual({
      logs: [
        {
          id: "log-1",
          type: "SYSTEM",
          action: "LOGIN",
          subject: "AUTH",
          details: null,
          createdAt: createdAt.toISOString(),
          user: {
            id: "user-1",
            name: "Budi",
            email: "budi@example.com",
          },
        },
      ],
      pagination: {
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
      },
    });
  });
});
