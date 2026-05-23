import { describe, expect, it, vi } from "vitest";
import { AccelPppMonitor } from "@/modules/network/services/accel-ppp/AccelPppMonitor";
import type { AccelPppServerEntity } from "@/modules/network/domain/entities/AccelPppServerEntity";

vi.mock("@/lib/tenant-context", async (importOriginal) => {
  const actual = await (
    importOriginal as () => Promise<Record<string, unknown>>
  )();
  return {
    ...actual,
    runAsSystemContext: vi.fn(
      async (_reason: string, callback: () => Promise<unknown>) => callback(),
    ),
    runWithRequestTenantContext: vi.fn(
      async (_ctx: unknown, callback: () => Promise<unknown>) => callback(),
    ),
  };
});

function buildServer(
  overrides: Partial<AccelPppServerEntity> = {},
): AccelPppServerEntity {
  return {
    id: overrides.id ?? "srv-1",
    name: "ACCEL-PPP",
    ipAddress: overrides.ipAddress ?? "10.0.0.1",
    description: null,
    nasIdentifier: null,
    radiusSecret: "secret",
    authPort: 1812,
    acctPort: 1813,
    coaPort: 3799,
    cliHost: overrides.ipAddress ?? "10.0.0.1",
    cliPort: 2001,
    cliPassword: null,
    pingStatus: "offline",
    userOnline: 0,
    lastStatusCheck: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildRepo(servers: AccelPppServerEntity[]) {
  return {
    findAll: vi.fn(),
    findWithFilters: vi.fn(),
    findById: vi.fn(),
    findByIp: vi.fn(),
    findAllForMonitor: vi.fn().mockResolvedValue(servers),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

describe("AccelPppMonitor.checkAll", () => {
  it("kosong: return total 0 tanpa panggil CLI", async () => {
    const repo = buildRepo([]);
    const factory = vi.fn();
    const monitor = new AccelPppMonitor(repo as never, factory);

    const result = await monitor.checkAll();

    expect(result).toEqual({ total: 0, online: 0, offline: 0, errors: 0 });
    expect(factory).not.toHaveBeenCalled();
  });

  it("multi-server: hitung online vs offline + persist status", async () => {
    const servers = [
      buildServer({ id: "a", ipAddress: "10.0.0.1" }),
      buildServer({ id: "b", ipAddress: "10.0.0.2" }),
      buildServer({ id: "c", ipAddress: "10.0.0.3" }),
    ];
    const repo = buildRepo(servers);

    const factory = (server: AccelPppServerEntity) => {
      if (server.id === "b") {
        return {
          showStat: vi.fn().mockRejectedValue(new Error("connect refused")),
        };
      }
      return {
        showStat: vi.fn().mockResolvedValue({
          activeSessions: 3,
          startingSessions: 0,
          finishingSessions: 0,
          cpuPercent: null,
          raw: {},
        }),
      };
    };

    const monitor = new AccelPppMonitor(repo as never, factory);
    const result = await monitor.checkAll();

    expect(result).toEqual({ total: 3, online: 2, offline: 1, errors: 0 });
    expect(repo.updateStatus).toHaveBeenCalledTimes(3);
    expect(repo.updateStatus).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ pingStatus: "online", userOnline: 3 }),
    );
    expect(repo.updateStatus).toHaveBeenCalledWith(
      "b",
      expect.objectContaining({ pingStatus: "offline", userOnline: 0 }),
    );
  });

  it("isolation: server hang tidak ganggu server lain", async () => {
    const servers = [
      buildServer({ id: "fast" }),
      buildServer({ id: "slow", ipAddress: "10.0.0.99" }),
    ];
    const repo = buildRepo(servers);

    const factory = (server: AccelPppServerEntity) => {
      if (server.id === "slow") {
        return {
          showStat: vi
            .fn()
            .mockRejectedValue(new Error("timeout after 4000ms")),
        };
      }
      return {
        showStat: vi.fn().mockResolvedValue({
          activeSessions: 1,
          startingSessions: 0,
          finishingSessions: 0,
          cpuPercent: null,
          raw: {},
        }),
      };
    };

    const monitor = new AccelPppMonitor(repo as never, factory);
    const result = await monitor.checkAll();

    expect(result.total).toBe(2);
    expect(result.online).toBe(1);
    expect(result.offline).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("transition online → offline: server yg sebelumnya online jadi offline", async () => {
    const servers = [buildServer({ id: "x", pingStatus: "online" })];
    const repo = buildRepo(servers);

    const factory = () => ({
      showStat: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    const monitor = new AccelPppMonitor(repo as never, factory);
    await monitor.checkAll();

    expect(repo.updateStatus).toHaveBeenCalledWith("x", {
      pingStatus: "offline",
      userOnline: 0,
      lastStatusCheck: expect.any(Date),
    });
  });
});
