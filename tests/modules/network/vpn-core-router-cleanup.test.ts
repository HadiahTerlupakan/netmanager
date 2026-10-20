import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteCoreRouter: vi.fn(),
  isConfigured: vi.fn(),
  inSystemContext: false,
}));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: async <T>(_reason: string, cb: () => Promise<T>) => {
    mocks.inSystemContext = true;
    try {
      return await cb();
    } finally {
      mocks.inSystemContext = false;
    }
  },
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => ({ deleteRouter: mocks.deleteCoreRouter }),
  isVpnConfigured: mocks.isConfigured,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  retryVpnCoreRouterDeletes,
  VPN_TOMBSTONE_BATCH_SIZE,
} from "@/modules/network/services/VpnCoreRouterCleanup";
import { VpnCoreRouterTombstoneRepository } from "@/modules/network/repositories/VpnCoreRouterTombstoneRepository";
import { VpnCoreError } from "@/modules/network/vpn/VpnCoreClient";

function fakeRepo(ids: string[], usedIds: string[] = []) {
  return {
    listOldest: vi.fn(async (_limit: number) => ids),
    add: vi.fn(async (_id: string) => {}),
    remove: vi.fn(async (_id: string) => {}),
    isUsedByRouter: vi.fn(async (id: string) => usedIds.includes(id)),
  };
}

describe("retryVpnCoreRouterDeletes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConfigured.mockReturnValue(true);
  });

  it("menghapus baris saat core sukses atau 404, membiarkannya pada error lain", async () => {
    const repo = fakeRepo(["ok", "gone", "down"]);
    mocks.deleteCoreRouter.mockImplementation(async (id: string) => {
      if (id === "gone") throw new VpnCoreError(404, "not_found");
      if (id === "down") throw new VpnCoreError(500, "internal");
    });

    await retryVpnCoreRouterDeletes(repo);

    expect(repo.listOldest).toHaveBeenCalledWith(VPN_TOMBSTONE_BATCH_SIZE);
    expect(repo.remove.mock.calls.map((c) => c[0])).toEqual(["ok", "gone"]);
  });

  it("berhenti di error non-404 pertama: id berikutnya tidak dicoba", async () => {
    const repo = fakeRepo(["down", "next"]);
    mocks.deleteCoreRouter.mockRejectedValue(new VpnCoreError(502, "internal"));

    await retryVpnCoreRouterDeletes(repo);

    expect(mocks.deleteCoreRouter).toHaveBeenCalledTimes(1);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("membuang tombstone yang dipakai router aktif tanpa menghapusnya di core", async () => {
    const repo = fakeRepo(["live", "stale"], ["live"]);
    mocks.deleteCoreRouter.mockResolvedValue(undefined);

    await retryVpnCoreRouterDeletes(repo);

    expect(mocks.deleteCoreRouter.mock.calls.map((c) => c[0])).toEqual([
      "stale",
    ]);
    expect(repo.remove.mock.calls.map((c) => c[0])).toEqual(["live", "stale"]);
  });

  it("memeriksa router aktif di konteks sistem (lintas tenant)", async () => {
    const repo = fakeRepo(["a"]);
    let wasSystem = false;
    repo.isUsedByRouter.mockImplementation(async () => {
      wasSystem = mocks.inSystemContext;
      return false;
    });

    await retryVpnCoreRouterDeletes(repo);

    expect(wasSystem).toBe(true);
  });

  it("tidak memanggil core maupun database bila VPN belum dikonfigurasi", async () => {
    mocks.isConfigured.mockReturnValue(false);
    const repo = fakeRepo(["a"]);

    await retryVpnCoreRouterDeletes(repo);

    expect(repo.listOldest).not.toHaveBeenCalled();
    expect(mocks.deleteCoreRouter).not.toHaveBeenCalled();
  });
});

describe("VpnCoreRouterTombstoneRepository", () => {
  it("add idempoten lewat upsert, listOldest urut createdAt, remove tidak gagal bila baris hilang", async () => {
    const client = {
      vpnCoreRouterTombstone: {
        upsert: vi.fn(async () => ({})),
        findMany: vi.fn(async () => [{ coreRouterId: "a" }]),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };
    const repo = new VpnCoreRouterTombstoneRepository(client as never);

    await repo.add("a");
    expect(await repo.listOldest(5)).toEqual(["a"]);
    await repo.remove("a");

    expect(client.vpnCoreRouterTombstone.upsert).toHaveBeenCalledWith({
      where: { coreRouterId: "a" },
      create: { coreRouterId: "a" },
      update: {},
    });
    expect(client.vpnCoreRouterTombstone.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    expect(client.vpnCoreRouterTombstone.deleteMany).toHaveBeenCalledWith({
      where: { coreRouterId: "a" },
    });
  });
});

describe("VpnCoreRouterTombstoneRepository lookups", () => {
  it("has dan isUsedByRouter mencari menurut id router core", async () => {
    const client = {
      vpnCoreRouterTombstone: {
        findUnique: vi.fn(async () => ({ coreRouterId: "a" })),
      },
      mikroTikRouter: { findFirst: vi.fn(async () => null) },
    };
    const repo = new VpnCoreRouterTombstoneRepository(client as never);

    expect(await repo.has("a")).toBe(true);
    expect(await repo.isUsedByRouter("a")).toBe(false);
    expect(client.mikroTikRouter.findFirst).toHaveBeenCalledWith({
      where: { vpnCoreRouterId: "a" },
      select: { id: true },
    });
  });
});
