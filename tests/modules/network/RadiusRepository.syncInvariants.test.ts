import { beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { prismaMock } from "../../setup";
import { RadiusRepository } from "@/modules/network/repositories/RadiusRepository";

describe("RadiusRepository sync invariants", () => {
  let repository: RadiusRepository;

  beforeEach(() => {
    repository = new RadiusRepository(prismaMock as unknown as PrismaClient);
  });

  it("removes stale package groups when pelanggan no longer has an active package", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValueOnce({
      id: "pelanggan-1",
      username: "user-1",
      password: "secret",
      status: "AKTIF",
      tenantId: "tenant-1",
      hargaPaket: null,
    });
    prismaMock.radcheck.count.mockResolvedValueOnce(1);
    prismaMock.radusergroup.findMany.mockResolvedValueOnce([
      { groupname: "pkg-lama" },
      { groupname: "ISOLIR" },
    ]);

    await repository.syncPelangganToRadius("pelanggan-1");

    expect(prismaMock.radusergroup.deleteMany).toHaveBeenCalledWith({
      where: {
        username: "user-1",
        groupname: "pkg-lama",
        tenantId: "tenant-1",
      },
    });
    expect(prismaMock.radusergroup.deleteMany).toHaveBeenCalledWith({
      where: {
        username: "user-1",
        groupname: "ISOLIR",
        tenantId: "tenant-1",
      },
    });
  });

  it("preserves active leases when syncing IP pool ranges", async () => {
    prismaMock.radippool.findMany.mockResolvedValueOnce([
      {
        id: 1,
        pool_name: "POOL-1",
        framedipaddress: "10.0.0.1",
        nasipaddress: "",
        calledstationid: "",
        callingstationid: "",
        username: "",
        pool_key: "",
        expiry_time: new Date("2026-04-16T00:00:00.000Z"),
        tenantId: "tenant-1",
      },
      {
        id: 2,
        pool_name: "POOL-1",
        framedipaddress: "10.0.0.2",
        nasipaddress: "172.16.0.1",
        calledstationid: "called-1",
        callingstationid: "calling-1",
        username: "user-1",
        pool_key: "lease-1",
        expiry_time: new Date("2026-04-16T00:00:00.000Z"),
        tenantId: "tenant-1",
      },
      {
        id: 3,
        pool_name: "POOL-1",
        framedipaddress: "10.0.0.3",
        nasipaddress: "",
        calledstationid: "",
        callingstationid: "",
        username: "",
        pool_key: "",
        expiry_time: new Date("2026-04-16T00:00:00.000Z"),
        tenantId: "tenant-1",
      },
    ]);

    await repository.syncIpPoolToRadius(
      "POOL-1",
      "10.0.0.2-10.0.0.4",
      "tenant-1",
    );

    expect(prismaMock.radippool.deleteMany).not.toHaveBeenCalledWith({
      where: {
        pool_name: "POOL-1",
        tenantId: "tenant-1",
      },
    });
    expect(prismaMock.radippool.deleteMany).toHaveBeenCalledWith({
      where: {
        pool_name: "POOL-1",
        framedipaddress: { in: ["10.0.0.1"] },
        tenantId: "tenant-1",
        nasipaddress: "",
        pool_key: "",
        username: "",
      },
    });
    expect(prismaMock.radippool.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            pool_name: "POOL-1",
            framedipaddress: "10.0.0.4",
            tenantId: "tenant-1",
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });
});
