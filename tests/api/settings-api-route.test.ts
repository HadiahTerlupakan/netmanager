import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetApiSettings = vi.fn();
const mockUpdateApiSettings = vi.fn();
const mockClearR2SettingsCache = vi.fn();
const mockLogActivitySafe = vi.fn();

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (req: Request, ctx: unknown) => unknown,
  ) => handler,
  apiSuccess: <T>(data: T) => data,
}));

vi.mock("@/modules/settings", () => ({
  getApiSettings: (...args: unknown[]) => mockGetApiSettings(...args),
  updateApiSettings: (...args: unknown[]) => mockUpdateApiSettings(...args),
}));

vi.mock("@/lib/utils/r2-client", () => ({
  clearR2SettingsCache: (...args: unknown[]) =>
    mockClearR2SettingsCache(...args),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: (...args: unknown[]) => mockLogActivitySafe(...args),
}));

import { GET, POST } from "@/app/api/settings/api/route";

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

    const result = await POST(
      new NextRequest("http://localhost/api/settings/api", {
        method: "POST",
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
    expect(result).toEqual({ success: true });
  });
});
