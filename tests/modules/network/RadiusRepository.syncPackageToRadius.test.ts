import { beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { prismaMock } from "../../setup";
import { RadiusRepository } from "@/modules/network/repositories/RadiusRepository";

describe("RadiusRepository syncPackageToRadius", () => {
  let repository: RadiusRepository;

  beforeEach(() => {
    repository = new RadiusRepository(prismaMock as unknown as PrismaClient);
  });

  it("removes stale rate limit when package no longer has bandwidth", async () => {
    prismaMock.hargaPaket.findUnique.mockResolvedValueOnce({
      id: "pkg-1",
      tenantId: "tenant-1",
      bandwidth: null,
      profilePPP: {
        id: "profile-1",
        name: "PROFILE-1",
        remoteAddress: "POOL-1",
        poolMode: "MIKROTIK",
      },
    });

    await repository.syncPackageToRadius("pkg-1");

    expect(prismaMock.radgroupreply.deleteMany).toHaveBeenCalledWith({
      where: {
        groupname: "pkg-1",
        attribute: "Mikrotik-Rate-Limit",
        tenantId: "tenant-1",
      },
    });
  });

  it("removes stale profile and pool attributes when package no longer has profile PPP", async () => {
    prismaMock.hargaPaket.findUnique.mockResolvedValueOnce({
      id: "pkg-1",
      tenantId: "tenant-1",
      bandwidth: null,
      profilePPP: null,
    });

    await repository.syncPackageToRadius("pkg-1");

    expect(prismaMock.radgroupreply.deleteMany).toHaveBeenCalledWith({
      where: {
        groupname: "pkg-1",
        attribute: "Mikrotik-Group",
        tenantId: "tenant-1",
      },
    });
    expect(prismaMock.radgroupreply.deleteMany).toHaveBeenCalledWith({
      where: {
        groupname: "pkg-1",
        attribute: "Framed-Pool",
        tenantId: "tenant-1",
      },
    });
    expect(prismaMock.radgroupcheck.deleteMany).toHaveBeenCalledWith({
      where: {
        groupname: "pkg-1",
        attribute: "Pool-Name",
        tenantId: "tenant-1",
      },
    });
  });
});
