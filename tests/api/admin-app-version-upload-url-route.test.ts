import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasPermission = vi.fn();
const mockGetPresignedUrl = vi.fn();
const mockGenerateR2Key = vi.fn();

vi.mock("@/lib/rbac", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock("@/lib/utils/r2-client", () => ({
  getPresignedUrl: (...args: unknown[]) => mockGetPresignedUrl(...args),
  generateR2Key: (...args: unknown[]) => mockGenerateR2Key(...args),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (
      req: Request,
      ctx: { session: { user: { id: string } } },
    ) => unknown,
  ) => {
    return (req: Request) =>
      handler(req, { session: { user: { id: "admin-1" } } });
  },
  apiSuccess: (data: unknown) => ({ success: true, data }),
  apiError: (error: string, code: string, options?: { status?: number }) => ({
    success: false,
    error,
    code,
    status: options?.status,
  }),
  ApiErrors: {
    forbidden: (message: string) => ({
      success: false,
      error: message,
      status: 403,
    }),
  },
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

import { POST } from "@/app/api/admin/app-version/upload-url/route";

describe("POST /api/admin/app-version/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockGenerateR2Key.mockReturnValue("uploads/apk/123-release.apk");
    mockGetPresignedUrl.mockResolvedValue({
      uploadUrl: "https://upload.example.com",
      publicUrl: "https://cdn.example.com/uploads/apk/123-release.apk",
    });
  });

  it("rejects non-apk filenames", async () => {
    const request = new NextRequest(
      "http://localhost/api/admin/app-version/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          filename: "release.zip",
          contentType: "application/octet-stream",
          size: 100,
        }),
        headers: { "content-type": "application/json" },
      },
    );

    const result = await POST(request, { params: Promise.resolve({}) });

    expect(result).toEqual({
      success: false,
      error: "File yang diupload harus berformat APK",
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(mockGetPresignedUrl).not.toHaveBeenCalled();
  });

  it("omits content disposition when generating presigned upload URL", async () => {
    const request = new NextRequest(
      "http://localhost/api/admin/app-version/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          filename: "release.apk",
          contentType: "application/vnd.android.package-archive",
          size: 100,
        }),
        headers: { "content-type": "application/json" },
      },
    );

    const result = await POST(request, { params: Promise.resolve({}) });

    expect(mockGenerateR2Key).toHaveBeenCalledWith(
      "app-version",
      "release.apk",
    );
    expect(mockGetPresignedUrl).toHaveBeenCalledWith(
      "uploads/apk/123-release.apk",
      "application/vnd.android.package-archive",
      3600,
    );
    expect(result).toEqual({
      success: true,
      data: {
        uploadUrl: "https://upload.example.com",
        publicUrl: "https://cdn.example.com/uploads/apk/123-release.apk",
        key: "uploads/apk/123-release.apk",
        filename: "release.apk",
      },
    });
  });
});
