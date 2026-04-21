import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTenantFindMany, mockGlobalFindMany } = vi.hoisted(() => ({
  mockTenantFindMany: vi.fn(),
  mockGlobalFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    settings: {
      findMany: mockTenantFindMany,
    },
  },
  prismaAuth: {
    settings: {
      findMany: mockGlobalFindMany,
    },
  },
}));

import { SettingsRepository } from "@/modules/settings/repositories/SettingsRepository";

describe("SettingsRepository.findManyByKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses prismaAuth for global settings reads", async () => {
    mockGlobalFindMany.mockResolvedValue([
      {
        key: "GENERAL_NAMA_APLIKASI",
        value: "NetManager",
        encrypted: false,
      },
    ]);

    const result = await SettingsRepository.findManyByKeys([
      "GENERAL_NAMA_APLIKASI",
    ]);

    expect(mockGlobalFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: null,
        key: {
          in: ["GENERAL_NAMA_APLIKASI"],
        },
      },
    });
    expect(mockTenantFindMany).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        key: "GENERAL_NAMA_APLIKASI",
        value: "NetManager",
        encrypted: false,
      },
    ]);
  });

  it("uses tenant-isolated prisma for tenant settings reads", async () => {
    mockTenantFindMany.mockResolvedValue([
      {
        key: "LOGO_APLIKASI",
        value: "/uploads/logo.png",
        encrypted: false,
      },
    ]);

    const result = await SettingsRepository.findManyByKeys(
      ["LOGO_APLIKASI"],
      "tenant-1",
    );

    expect(mockTenantFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        key: {
          in: ["LOGO_APLIKASI"],
        },
      },
    });
    expect(mockGlobalFindMany).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        key: "LOGO_APLIKASI",
        value: "/uploads/logo.png",
        encrypted: false,
      },
    ]);
  });
});
