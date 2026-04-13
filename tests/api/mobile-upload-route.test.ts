import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  convertAndSaveImage: vi.fn(),
  deleteUploadedFile: vi.fn(),
  isImageFile: vi.fn(),
  getR2Settings: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: mockFns.convertAndSaveImage,
  deleteUploadedFile: mockFns.deleteUploadedFile,
  getR2Settings: mockFns.getR2Settings,
  isImageFile: mockFns.isImageFile,
}));

import { DELETE, POST } from "@/app/api/mobile/upload/route";

describe("mobile upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
    });
    mockFns.getR2Settings.mockResolvedValue(null);
    mockFns.isImageFile.mockReturnValue(true);
    mockFns.convertAndSaveImage.mockResolvedValue(
      "/uploads/employee/attendance/test-photo.webp",
    );
  });

  it("returns top-level url for mobile clients after a successful upload", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
        type: "image/jpeg",
      }),
    );
    formData.set("type", "employee-attendance");

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/upload", {
        method: "POST",
        body: formData,
        headers: {
          host: "localhost:3000",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      url: "https://localhost:3000/uploads/employee/attendance/test-photo.webp",
      data: {
        url: "https://localhost:3000/uploads/employee/attendance/test-photo.webp",
        fileName: expect.any(String),
      },
    });
  });

  it("deletes trusted uploaded attendance photo urls", async () => {
    mockFns.deleteUploadedFile.mockResolvedValue(true);

    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/mobile/upload?url=https%3A%2F%2Flocalhost%3A3000%2Fuploads%2Femployee%2Fattendance%2Ftest-photo.webp",
        {
          method: "DELETE",
          headers: {
            host: "localhost:3000",
            "x-forwarded-proto": "https",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockFns.deleteUploadedFile).toHaveBeenCalledWith(
      "https://localhost:3000/uploads/employee/attendance/test-photo.webp",
    );

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
    });
  });

  it("accepts trusted custom public upload urls from R2 settings", async () => {
    mockFns.getR2Settings.mockResolvedValue({
      publicUrl: "https://cdn.radpro.id",
    });
    mockFns.deleteUploadedFile.mockResolvedValue(true);

    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/mobile/upload?url=https%3A%2F%2Fcdn.radpro.id%2Fuploads%2Femployee%2Fattendance%2Ftest-photo.webp",
        {
          method: "DELETE",
          headers: {
            host: "localhost:3000",
            "x-forwarded-proto": "https",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockFns.deleteUploadedFile).toHaveBeenCalledWith(
      "https://cdn.radpro.id/uploads/employee/attendance/test-photo.webp",
    );
  });

  it("accepts trusted default R2 upload urls", async () => {
    mockFns.deleteUploadedFile.mockResolvedValue(true);

    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/mobile/upload?url=https%3A%2F%2Fbucket.account.r2.cloudflarestorage.com%2Fuploads%2Femployee%2Fattendance%2Ftest-photo.webp",
        {
          method: "DELETE",
          headers: {
            host: "localhost:3000",
            "x-forwarded-proto": "https",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockFns.deleteUploadedFile).toHaveBeenCalledWith(
      "https://bucket.account.r2.cloudflarestorage.com/uploads/employee/attendance/test-photo.webp",
    );
  });
});
