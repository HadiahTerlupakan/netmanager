import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetLogoSettings = vi.fn();
const mockUploadLogo = vi.fn();
const mockDeleteLogo = vi.fn();
const mockHasPermission = vi.fn();
const mockLogActivitySafe = vi.fn();

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (req: Request, ctx: unknown) => unknown,
  ) => handler,
  apiSuccess: <T>(data: T) => data,
  ApiErrors: {
    forbidden: (message: string) => ({ error: message, status: 403 }),
    badRequest: (message: string) => ({ error: message, status: 400 }),
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: (...args: unknown[]) => mockLogActivitySafe(...args),
}));

vi.mock("@/modules/settings", () => ({
  getLogoSettings: (...args: unknown[]) => mockGetLogoSettings(...args),
  uploadLogo: (...args: unknown[]) => mockUploadLogo(...args),
  deleteLogo: (...args: unknown[]) => mockDeleteLogo(...args),
}));

import { DELETE, GET, POST } from "@/app/api/settings/logo/route";

describe("settings logo route tenant scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  it("reads logo settings using tenant id from session", async () => {
    mockGetLogoSettings.mockResolvedValue({
      logoInvoice: "/uploads/logos/logo-invoice.png",
      logoAplikasi: "/uploads/logos/logo-aplikasi.png",
    });

    const result = await GET(
      new NextRequest("http://localhost/api/settings/logo"),
      {
        session: { user: { tenantId: "tenant-1" } },
      } as never,
    );

    expect(mockGetLogoSettings).toHaveBeenCalledWith("tenant-1");
    expect(result).toEqual({
      logoInvoice: "/uploads/logos/logo-invoice.png",
      logoAplikasi: "/uploads/logos/logo-aplikasi.png",
    });
  });

  it("uploads logo using tenant id from session", async () => {
    mockUploadLogo.mockResolvedValue("/uploads/logos/logo-aplikasi.png");
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "aplikasi");

    const request = new NextRequest("http://localhost/api/settings/logo", {
      method: "POST",
      body: formData,
    });

    const result = await POST(request, {
      session: { user: { id: "user-1", tenantId: "tenant-1" } },
    } as never);

    expect(mockUploadLogo).toHaveBeenCalledWith(
      "aplikasi",
      expect.objectContaining({ name: "logo.png", type: "image/png" }),
      "tenant-1",
    );
    expect(result).toEqual({
      success: true,
      logoPath: "/uploads/logos/logo-aplikasi.png",
    });
  });

  it("deletes logo using tenant id from session", async () => {
    mockDeleteLogo.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/settings/logo", {
      method: "DELETE",
      body: JSON.stringify({ type: "aplikasi" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await DELETE(request, {
      session: { user: { id: "user-1", tenantId: "tenant-1" } },
      validated: { type: "aplikasi" },
    } as never);

    expect(mockDeleteLogo).toHaveBeenCalledWith("aplikasi", "tenant-1");
    expect(result).toEqual({ success: true });
  });
});
