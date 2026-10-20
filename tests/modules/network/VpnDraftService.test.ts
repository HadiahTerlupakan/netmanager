import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMock = vi.hoisted(() => ({
  createRouter: vi.fn(),
  getRouter: vi.fn(),
  deleteRouter: vi.fn(),
  routerScript: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => coreMock,
}));

import {
  assertDraftOwned,
  VpnDraftService,
} from "@/modules/network/services/VpnDraftService";
import {
  VpnCoreError,
  VpnDraftForbiddenError,
  VpnServerNotAvailableError,
} from "@/modules/network/vpn";
import type { CoreRouter } from "@/modules/network/vpn/types";

const NOW = Date.parse("2026-10-20T10:00:00.000Z");

function router(overrides: Partial<CoreRouter> = {}): CoreRouter {
  return {
    id: "r-1",
    label: "nm:t1",
    ref: "",
    address: "10.100.0.10",
    status: "pending",
    hubs: [
      { hubId: "a", name: "A", priority: 0, syncState: "synced" },
      { hubId: "b", name: "B", priority: 1, syncState: "synced" },
    ],
    activeHubId: null,
    lastHandshakeAt: null,
    events: [],
    ...overrides,
  };
}

const servers = [
  { id: "a", name: "A", publicHost: "a.example.com", status: "online" },
  { id: "b", name: "B", publicHost: "b.example.com", status: "online" },
  { id: "c", name: "C", publicHost: "c.example.com", status: "offline" },
];

function makeService(tombstonedIds: string[] = []) {
  const repo = { tenantServers: vi.fn().mockResolvedValue(servers) };
  const tombstones = {
    has: vi.fn(async (id: string) => tombstonedIds.includes(id)),
  };
  return new VpnDraftService(repo as never, () => NOW, tombstones);
}

describe("VpnDraftService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMock.createRouter.mockResolvedValue(router());
    coreMock.routerScript.mockResolvedValue("# core script\n");
    coreMock.deleteRouter.mockResolvedValue(undefined);
  });

  it("rejects a server that is not assigned to the tenant or not online", async () => {
    const svc = makeService();
    await expect(
      svc.createDraft("t1", { serverIds: ["zzz"] }),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    await expect(
      svc.createDraft("t1", { serverIds: ["a", "c"] }),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    expect(coreMock.createRouter).not.toHaveBeenCalled();
  });

  it("creates a labelled router and builds the combined script with credentials", async () => {
    const result = await makeService().createDraft("t1", {
      serverIds: ["a", "b"],
    });
    expect(coreMock.createRouter).toHaveBeenCalledWith({
      label: "nm:t1",
      hubIds: ["a", "b"],
    });
    expect(result.draftId).toBe("r-1");
    expect(result.address).toBe("10.100.0.10");
    expect(result.apiUsername).toMatch(/^netmanager-[0-9a-f]{8}$/);
    expect(result.apiPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(result.script.startsWith("# core script\n\n")).toBe(true);
    expect(result.script).toContain(`name="${result.apiUsername}"`);
    expect(result.script).toContain(`password="${result.apiPassword}"`);
  });

  it("keeps credentials supplied by the caller", async () => {
    const result = await makeService().createDraft("t1", {
      serverIds: ["a"],
      apiUsername: "netmanager-deadbeef",
      apiPassword: "A".repeat(24),
    });
    expect(result.apiUsername).toBe("netmanager-deadbeef");
    expect(result.apiPassword).toBe("A".repeat(24));
  });

  it("reuses the previous draft when the hub list and order are the same", async () => {
    coreMock.getRouter.mockResolvedValue(router({ id: "prev" }));
    const result = await makeService().createDraft("t1", {
      serverIds: ["a", "b"],
      previousDraftId: "prev",
    });
    expect(coreMock.createRouter).not.toHaveBeenCalled();
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
    expect(result.draftId).toBe("prev");
    expect(coreMock.routerScript).toHaveBeenCalledWith("prev", "full");
  });

  it("never reuses a tombstoned draft, even with the same hub list", async () => {
    coreMock.getRouter.mockResolvedValue(router({ id: "prev" }));
    coreMock.createRouter.mockResolvedValue(router({ id: "fresh" }));
    const result = await makeService(["prev"]).createDraft("t1", {
      serverIds: ["a", "b"],
      previousDraftId: "prev",
    });
    expect(coreMock.createRouter).toHaveBeenCalledOnce();
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
    expect(result.draftId).toBe("fresh");
  });

  it("treats a different priority order as a different list", async () => {
    coreMock.getRouter.mockResolvedValue(router({ id: "prev" }));
    await makeService().createDraft("t1", {
      serverIds: ["b", "a"],
      previousDraftId: "prev",
    });
    expect(coreMock.deleteRouter).toHaveBeenCalledWith("prev");
    expect(coreMock.createRouter).toHaveBeenCalledOnce();
  });

  it("deletes the previous draft before creating when the list differs", async () => {
    coreMock.getRouter.mockResolvedValue(router({ id: "prev" }));
    await makeService().createDraft("t1", {
      serverIds: ["a"],
      previousDraftId: "prev",
    });
    expect(coreMock.deleteRouter.mock.invocationCallOrder[0]).toBeLessThan(
      coreMock.createRouter.mock.invocationCallOrder[0],
    );
  });

  it("creates a new draft when the previous one is gone from core", async () => {
    coreMock.getRouter.mockRejectedValue(new VpnCoreError(404, "not_found"));
    const result = await makeService().createDraft("t1", {
      serverIds: ["a"],
      previousDraftId: "gone",
    });
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
    expect(result.draftId).toBe("r-1");
  });

  it("never deletes or reuses a previous router that is already in use", async () => {
    coreMock.getRouter.mockResolvedValue(
      router({ id: "live", status: "active", ref: "router-9" }),
    );
    const diff = await makeService().createDraft("t1", {
      serverIds: ["a"],
      previousDraftId: "live",
    });
    const same = await makeService().createDraft("t1", {
      serverIds: ["a", "b"],
      previousDraftId: "live",
    });
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
    expect(coreMock.createRouter).toHaveBeenCalledTimes(2);
    expect([diff.draftId, same.draftId]).toEqual(["r-1", "r-1"]);
  });

  it("refuses a previous draft owned by another tenant without deleting it", async () => {
    coreMock.getRouter.mockResolvedValue(router({ label: "nm:other" }));
    await expect(
      makeService().createDraft("t1", {
        serverIds: ["a"],
        previousDraftId: "prev",
      }),
    ).rejects.toBeInstanceOf(VpnDraftForbiddenError);
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
    expect(coreMock.createRouter).not.toHaveBeenCalled();
  });

  describe("getStatus", () => {
    it("is tunnel_up for a handshake within 180 s and waiting after", async () => {
      const fresh = new Date(NOW - 180_000).toISOString();
      const stale = new Date(NOW - 180_001).toISOString();
      coreMock.getRouter.mockResolvedValueOnce(
        router({ lastHandshakeAt: fresh, activeHubId: "a" }),
      );
      expect(await makeService().getStatus("t1", "r-1")).toEqual({
        stage: "tunnel_up",
        lastHandshakeAt: fresh,
        activeServerId: "a",
      });
      coreMock.getRouter.mockResolvedValueOnce(
        router({ lastHandshakeAt: stale }),
      );
      expect((await makeService().getStatus("t1", "r-1")).stage).toBe(
        "waiting",
      );
    });

    it("is waiting without any handshake", async () => {
      coreMock.getRouter.mockResolvedValue(router());
      expect(await makeService().getStatus("t1", "r-1")).toEqual({
        stage: "waiting",
        lastHandshakeAt: null,
        activeServerId: null,
      });
    });

    it("is forbidden for another tenant's draft", async () => {
      coreMock.getRouter.mockResolvedValue(router({ label: "nm:other" }));
      await expect(makeService().getStatus("t1", "r-1")).rejects.toBeInstanceOf(
        VpnDraftForbiddenError,
      );
    });
  });

  it("assertDraftOwned passes for the owner", () => {
    expect(() => assertDraftOwned(router(), "t1")).not.toThrow();
  });
});
