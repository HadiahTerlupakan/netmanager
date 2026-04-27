import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTenantFindMany, mockGlobalFindMany, mockGlobalFindFirst } =
  vi.hoisted(() => ({
    mockTenantFindMany: vi.fn(),
    mockGlobalFindMany: vi.fn(),
    mockGlobalFindFirst: vi.fn(),
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
      findFirst: mockGlobalFindFirst,
    },
  },
}));

import {
  clearR2SettingsCache,
  getR2PublicBaseUrl,
  getR2Settings,
} from "@/lib/utils/r2-client";

describe("getR2Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearR2SettingsCache();
  });

  it("uses prismaAuth for global R2 settings reads", async () => {
    mockGlobalFindMany.mockResolvedValue(buildR2SettingsRows());

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

  it("reads public R2 base URL without loading secret credentials", async () => {
    mockGlobalFindFirst.mockResolvedValue({ value: "https://cdn.radpro.id/" });

    const result = await getR2PublicBaseUrl();

    expect(mockGlobalFindFirst).toHaveBeenCalledWith({
      where: { key: "R2_PUBLIC_URL" },
      select: { value: true },
    });
    expect(mockGlobalFindMany).not.toHaveBeenCalled();
    expect(mockTenantFindMany).not.toHaveBeenCalled();
    expect(result).toBe("https://cdn.radpro.id");
  });
});

function buildR2SettingsRows() {
  return [
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
  ];
}
