import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { MikroTikRouterRepository } from "@/modules/network/repositories/MikroTikRouterRepository";

function listRepository(rows: object[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const client = {
    mikroTikRouter: { findMany, count: vi.fn().mockResolvedValue(rows.length) },
  } as unknown as PrismaClient;
  return { repository: new MikroTikRouterRepository(client), findMany };
}

function row(id: string, overrides: object = {}) {
  return {
    id,
    connectionMode: "VPN",
    vpnActiveServerId: null as string | null,
    vpnServers: [{ vpnServerId: "s1" }],
    ...overrides,
  };
}

async function onBackup(rows: object[]): Promise<boolean[]> {
  const { repository } = listRepository(rows);
  const result = await repository.findWithFilters(
    {},
    { page: 1, limit: 10 },
    "t1",
  );
  return result.routers.map((router) => router.vpnOnBackup);
}

describe("MikroTikRouterRepository.findWithFilters vpnOnBackup", () => {
  it("selects the priority-0 server in the list query itself", async () => {
    const { repository, findMany } = listRepository([]);

    await repository.findWithFilters({}, { page: 1, limit: 10 }, "t1");

    expect(findMany.mock.calls[0][0].include).toEqual({
      vpnServers: {
        orderBy: { priority: "asc" },
        take: 1,
        select: { vpnServerId: true },
      },
    });
  });

  it("flags only a VPN router whose active server is not its first server", async () => {
    expect(
      await onBackup([
        row("a", { vpnActiveServerId: "s2" }),
        row("b", { vpnActiveServerId: "s1" }),
        row("c"),
        row("d", { vpnActiveServerId: "s2", connectionMode: "PUBLIC" }),
        row("e", { vpnActiveServerId: "s2", vpnServers: [] }),
      ]),
    ).toEqual([true, false, false, false, false]);
  });

  it("does not leak the joined server rows into the list item", async () => {
    const { repository } = listRepository([
      row("a", { vpnActiveServerId: "s2" }),
    ]);

    const result = await repository.findWithFilters(
      {},
      { page: 1, limit: 10 },
      "t1",
    );

    expect(result.routers[0]).not.toHaveProperty("vpnServers");
  });
});

describe("MikroTikRouterRepository.update vpnActiveServerId", () => {
  it("writes the active server when given and leaves it alone otherwise", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = {
      mikroTikRouter: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany,
      },
    } as unknown as PrismaClient;
    const repository = new MikroTikRouterRepository(client);

    await repository.update("r1", { vpnActiveServerId: "s2" }, "t1");
    await repository.update("r1", { pingStatus: "online" }, "t1");

    expect(updateMany.mock.calls[0][0].data.vpnActiveServerId).toBe("s2");
    expect(updateMany.mock.calls[1][0].data).not.toHaveProperty(
      "vpnActiveServerId",
    );
  });
});
