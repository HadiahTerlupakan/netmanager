import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetApiSettings = vi.fn();
const mockUpdateApiSettings = vi.fn();
const mockClearR2SettingsCache = vi.fn();
const mockLogActivitySafe = vi.fn();
const mockTestCloudflareR2Connection = vi.fn();
const mockTestGoogleGeminiApiKey = vi.fn();

vi.mock("@/lib/api", () => ({
  createHandler: (
    options: unknown,
    handler: (req: Request, ctx: unknown) => unknown,
  ) => Object.assign(handler, { options }),
  apiSuccess: <T>(data: T) => data,
}));

vi.mock("@/modules/settings", () => ({
  getApiSettings: (...args: unknown[]) => mockGetApiSettings(...args),
  // Route menyamarkan rahasia sebelum mengirim respons. Implementasi aslinya
  // diuji terpisah di `tests/modules/settings/apiSettings.secret-masking`;
  // di sini cukup diteruskan agar assertion tenant-scope tetap fokus.
  maskApiSettingsSecrets: (settings: unknown) => settings,
  createApiSettings: (...args: unknown[]) => mockUpdateApiSettings(...args),
  updateApiSettings: (...args: unknown[]) => mockUpdateApiSettings(...args),
  testCloudflareR2Connection: (...args: unknown[]) =>
    mockTestCloudflareR2Connection(...args),
  testGoogleGeminiApiKey: (...args: unknown[]) =>
    mockTestGoogleGeminiApiKey(...args),
}));

vi.mock("@/lib/utils/r2-client", () => ({
  clearR2SettingsCache: (...args: unknown[]) =>
    mockClearR2SettingsCache(...args),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: (...args: unknown[]) => mockLogActivitySafe(...args),
}));

import { GET, PUT } from "@/app/api/settings/api/route";
import { POST as TEST_GEMINI } from "@/app/api/settings/api/test/route";
import { POST as TEST_R2 } from "@/app/api/settings/api/r2/test/route";

describe("api settings route tenant scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads api settings using the authenticated tenant id", async () => {
    const payload = {
      googleGeminiApiKey: "",
      geminiEnabled: false,
      r2AccountId: "",
      r2AccessKeyId: "",
      r2SecretAccessKey: "",
      r2BucketName: "tenant-bucket",
      r2PublicUrl: "",
      r2Enabled: true,
    };
    mockGetApiSettings.mockResolvedValue(payload);

    const result = await GET(
      new NextRequest("http://localhost/api/settings/api"),
      {
        session: {
          user: {
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    expect(mockGetApiSettings).toHaveBeenCalledWith("tenant-1");
    expect(result).toEqual(payload);
  });

  it("writes api settings using the authenticated tenant id", async () => {
    const payload = {
      r2BucketName: "tenant-bucket",
      r2Enabled: true,
    };
    mockUpdateApiSettings.mockResolvedValue(undefined);

    const result = await PUT(
      new NextRequest("http://localhost/api/settings/api", {
        method: "PUT",
      }),
      {
        session: {
          user: {
            id: "user-1",
            tenantId: "tenant-1",
          },
        },
        validated: payload,
      } as never,
    );

    expect(mockUpdateApiSettings).toHaveBeenCalledWith("tenant-1", payload);
    expect(mockClearR2SettingsCache).toHaveBeenCalledTimes(1);
    expect(mockLogActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        subject: "Settings",
        userId: "user-1",
      }),
    );
    expect(result).toEqual({
      success: true,
      message: "Pengaturan API berhasil diupdate",
    });
  });

  it("uses api:update permission for saving API settings", () => {
    expect(
      (PUT as unknown as { options: { permissions: string[] } }).options
        .permissions,
    ).toEqual(["api:update"]);
  });

  it("uses api:update permission for R2 connection test", () => {
    expect(
      (TEST_R2 as unknown as { options: { permissions: string[] } }).options
        .permissions,
    ).toEqual(["api:update"]);
  });

  it("uses api:update permission for Gemini API key test", () => {
    expect(
      (TEST_GEMINI as unknown as { options: { permissions: string[] } }).options
        .permissions,
    ).toEqual(["api:update"]);
  });
});
