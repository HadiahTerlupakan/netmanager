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

import { clearR2SettingsCache, getR2Settings } from "@/lib/utils/r2-client";

describe("getR2Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearR2SettingsCache();
  });

  it("uses prismaAuth for global R2 settings reads", async () => {
    mockGlobalFindMany.mockResolvedValue([
      { key: "R2_ACCOUNT_ID", value: "acc-1", encrypted: false },
      { key: "R2_ACCESS_KEY_ID", value: "key-1", encrypted: false },
      { key: "R2_SECRET_ACCESS_KEY", value: "secret-1", encrypted: false },
      { key: "R2_BUCKET_NAME", value: "bucket-1", encrypted: false },
      {
        key: "R2_PUBLIC_URL",
        value: "https://cdn.radpro.id",
        encrypted: false,
      },
      { key: "R2_ENABLED", value: "true", encrypted: false },
    ]);

    const result = await getR2Settings();

    expect(mockGlobalFindMany).toHaveBeenCalledWith({
      where: {
        key: {
          in: [
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET_NAME",
            "R2_PUBLIC_URL",
            "R2_ENABLED",
          ],
        },
      },
    });
    expect(mockTenantFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      accountId: "acc-1",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
      bucketName: "bucket-1",
      publicUrl: "https://cdn.radpro.id",
      enabled: true,
    });
  });
});
