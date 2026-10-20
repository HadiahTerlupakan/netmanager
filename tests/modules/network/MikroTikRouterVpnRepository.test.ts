import { describe, expect, it, vi } from "vitest";

import { MikroTikRouterVpnRepository } from "@/modules/network/repositories/MikroTikRouterVpnRepository";

function makeClient(storedIds: string[], lockedCount = 1) {
  const calls: string[] = [];
  const tx = {
    mikroTikRouter: {
      updateMany: vi.fn(async (args: { data: { vpnScriptStale: boolean } }) => {
        calls.push(`stale=${args.data.vpnScriptStale}`);
        return { count: lockedCount };
      }),
    },
    mikroTikRouterVpnServer: {
      findMany: vi.fn(async () => {
        calls.push("readServers");
        return storedIds.map((vpnServerId) => ({ vpnServerId }));
      }),
    },
  };
  const client = {
    $transaction: vi.fn(async (work: (t: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const finalize = vi.fn(async () => {
    calls.push("finalize");
  });
  return { client, tx, calls, finalize };
}

describe("MikroTikRouterVpnRepository.completeScriptSend", () => {
  it("locks the row, then finalizes and clears stale when the list is unchanged", async () => {
    const t = makeClient(["c", "a"]);
    const repo = new MikroTikRouterVpnRepository(t.client as never);

    const isSent = await repo.completeScriptSend(
      "router-1",
      "t1",
      ["c", "a"],
      t.finalize,
    );

    expect(isSent).toBe(true);
    expect(t.calls).toEqual([
      "stale=true",
      "readServers",
      "finalize",
      "stale=false",
    ]);
    expect(t.tx.mikroTikRouter.updateMany).toHaveBeenCalledWith({
      where: { id: "router-1", tenantId: "t1" },
      data: { vpnScriptStale: true },
    });
    expect(t.tx.mikroTikRouterVpnServer.findMany).toHaveBeenCalledWith({
      where: { routerId: "router-1" },
      orderBy: { priority: "asc" },
      select: { vpnServerId: true },
    });
  });

  it("skips finalize and keeps the script stale when another request changed the list", async () => {
    const t = makeClient(["a", "c"]);
    const repo = new MikroTikRouterVpnRepository(t.client as never);

    const isSent = await repo.completeScriptSend(
      "router-1",
      "t1",
      ["c", "a"],
      t.finalize,
    );

    expect(isSent).toBe(false);
    expect(t.finalize).not.toHaveBeenCalled();
    expect(t.calls).toEqual(["stale=true", "readServers"]);
  });

  it("touches nothing else for a router outside the tenant", async () => {
    const t = makeClient(["c", "a"], 0);
    const repo = new MikroTikRouterVpnRepository(t.client as never);

    await expect(
      repo.completeScriptSend("router-1", "t1", ["c", "a"], t.finalize),
    ).resolves.toBe(false);
    expect(t.calls).toEqual(["stale=true"]);
  });

  it("keeps the script stale when the final core PUT fails", async () => {
    const t = makeClient(["c", "a"]);
    t.finalize.mockRejectedValue(new Error("core down"));
    const repo = new MikroTikRouterVpnRepository(t.client as never);

    await expect(
      repo.completeScriptSend("router-1", "t1", ["c", "a"], t.finalize),
    ).rejects.toThrow("core down");
    expect(t.calls).not.toContain("stale=false");
  });
});
