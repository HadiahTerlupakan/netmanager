import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  convertAndSaveImage: vi.fn(),
  isImageFile: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: mockFns.convertAndSaveImage,
  isImageFile: mockFns.isImageFile,
}));

import { POST } from "@/app/api/mobile/upload/route";

describe("mobile upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
    });
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
});
