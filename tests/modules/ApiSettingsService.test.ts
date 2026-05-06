import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptApiKey } from "@/lib/utils/encryption";
import {
  API_SETTINGS_KEYS,
  getApiSettings,
  updateApiSettings,
  type ApiSettingsPayload,
} from "@/modules/settings/services/apiSettings";
import { prismaMock } from "../setup";

const getTenantScopedApiSettings = getApiSettings as unknown as (
  tenantId: string,
) => Promise<ApiSettingsPayload>;

const updateTenantScopedApiSettings = updateApiSettings as unknown as (
  tenantId: string,
  payload: Partial<ApiSettingsPayload>,
) => Promise<void>;

describe("api settings service tenant scope", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.settings.findMany.mockResolvedValue([]);
    prismaMock.settings.findFirst.mockResolvedValue(null);
    prismaMock.settings.create.mockResolvedValue(undefined);
    prismaMock.settings.update.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }

      return Promise.resolve(callback);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("reads api settings from the authenticated tenant scope", async () => {
    prismaMock.settings.findMany.mockResolvedValue([
      {
        key: "R2_BUCKET_NAME",
        value: "tenant-bucket",
        encrypted: false,
      },
      {
        key: "R2_ENABLED",
        value: "true",
        encrypted: false,
      },
      {
        key: "R2_SECRET_ACCESS_KEY",
        value: encryptApiKey("tenant-secret"),
        encrypted: true,
      },
    ]);

    const result = await getTenantScopedApiSettings("tenant-1");

    expect(prismaMock.settings.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        key: {
          in: API_SETTINGS_KEYS,
        },
      },
    });
    expect(result).toMatchObject({
      r2BucketName: "tenant-bucket",
      r2Enabled: true,
      r2SecretAccessKey: "tenant-secret",
    });
  });

  it("returns secret placeholder when encrypted R2 secret cannot be decrypted", async () => {
    prismaMock.settings.findMany.mockResolvedValue([
      {
        key: "R2_SECRET_ACCESS_KEY",
        value: "0123456789abcdef0123456789abcdef:badciphertext",
        encrypted: true,
      },
    ]);

    const result = await getTenantScopedApiSettings("tenant-1");

    expect(result.r2SecretAccessKey).toBe("********");
  });

  it("does not overwrite encrypted R2 secret when placeholder is submitted", async () => {
    prismaMock.settings.findFirst.mockResolvedValue({
      id: "setting-1",
      key: "R2_BUCKET_NAME",
      value: "old-bucket",
      tenantId: "tenant-1",
      encrypted: false,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await updateTenantScopedApiSettings("tenant-1", {
      r2SecretAccessKey: "__KEEP_EXISTING__",
      r2BucketName: "tenant-bucket",
    });

    // Only R2_BUCKET_NAME should be updated, R2_SECRET_ACCESS_KEY with keep token should be skipped
    expect(prismaMock.settings.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.settings.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "setting-1" },
        data: expect.objectContaining({
          value: "tenant-bucket",
        }),
      }),
    );
  });

  it("writes api settings into the authenticated tenant scope", async () => {
    prismaMock.settings.findFirst
      .mockResolvedValueOnce({
        id: "setting-1",
        key: "R2_BUCKET_NAME",
        value: "old-bucket",
        tenantId: "tenant-1",
        encrypted: false,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "setting-2",
        key: "R2_ENABLED",
        value: "false",
        tenantId: "tenant-1",
        encrypted: false,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    await updateTenantScopedApiSettings("tenant-1", {
      r2BucketName: "tenant-bucket",
      r2Enabled: true,
    });

    expect(prismaMock.settings.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "setting-1" },
        data: expect.objectContaining({
          value: "tenant-bucket",
        }),
      }),
    );
    expect(prismaMock.settings.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "setting-2" },
        data: expect.objectContaining({
          value: "true",
        }),
      }),
    );
  });
});
