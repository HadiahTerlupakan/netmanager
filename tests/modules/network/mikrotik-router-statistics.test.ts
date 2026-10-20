import { describe, expect, it, vi } from "vitest";

import { MikroTikRouterRepository } from "@/modules/network/repositories/MikroTikRouterRepository";

describe("MikroTikRouterRepository.getStatistics", () => {
  it("menghitung tunnel_down sebagai offline", async () => {
    const statuses = ["online", "offline", "tunnel_down", "tunnel_down"];
    const matches = (status: string, filter: unknown) =>
      filter === undefined ||
      filter === status ||
      (typeof filter === "object" &&
        filter !== null &&
        (filter as { in: string[] }).in.includes(status));
    const client = {
      mikroTikRouter: {
        count: vi.fn(
          async (args: { where: { pingStatus?: unknown } }) =>
            statuses.filter((s) => matches(s, args.where.pingStatus)).length,
        ),
        findMany: vi.fn(async () => statuses.map(() => ({ userOnline: 1 }))),
      },
    };
    const repo = new MikroTikRouterRepository(client as never);

    const stats = await repo.getStatistics("t1");

    expect(stats).toMatchObject({ total: 4, online: 1, offline: 3 });
  });
});
