import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  convertAndSaveImage: vi.fn(),
  validateUploadFile: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      const wrappedHandler = async (req: NextRequest, ctx: unknown) =>
        handler(req, ctx);
      (wrappedHandler as unknown as { options: unknown }).options = options;
      return wrappedHandler;
    }),
    apiSuccess: vi.fn((data, options) =>
      NextResponse.json({ success: true, data }, options),
    ),
    ApiErrors: {
      forbidden: vi.fn(() =>
        NextResponse.json(
          { success: false, error: "forbidden" },
          { status: 403 },
        ),
      ),
      badRequest: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 400 }),
      ),
      internalError: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 500 }),
      ),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveImage: mockFns.convertAndSaveImage,
}));

vi.mock("@/lib/upload/upload-policy", () => ({
  validateUploadFile: mockFns.validateUploadFile,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { POST } from "@/app/api/admin/website/upload-logo/route";

function buildRequest(file: File | null) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

function buildCtx(superAdmin: boolean) {
  return {
    session: superAdmin
      ? { user: { id: "u1", email: "a@b.c", isSuperAdmin: true } }
      : { user: { id: "u1", email: "a@b.c", isSuperAdmin: false } },
  };
}

// In tests we invoke the mocked createHandler which calls our handler with
// the ctx object directly (not a route-context wrapper).
const invoke = POST as unknown as (
  req: NextRequest,
  ctx: unknown,
) => Promise<Response>;

describe("POST /api/admin/website/upload-logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-super-admin with 403", async () => {
    mockFns.isSuperAdmin.mockReturnValue(false);
    const file = new File(["x"], "logo.png", { type: "image/png" });
    const res = await invoke(buildRequest(file), buildCtx(false));
    expect(res.status).toBe(403);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is uploaded", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);
    const res = await invoke(buildRequest(null), buildCtx(true));
    expect(res.status).toBe(400);
    expect(mockFns.validateUploadFile).not.toHaveBeenCalled();
  });

  it("returns 400 when validation fails", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);
    mockFns.validateUploadFile.mockReturnValue({
      ok: false,
      error: "MIME type tidak diizinkan",
    });
    const file = new File(["x"], "logo.exe", {
      type: "application/x-msdownload",
    });
    const res = await invoke(buildRequest(file), buildCtx(true));
    expect(res.status).toBe(400);
    expect(mockFns.convertAndSaveImage).not.toHaveBeenCalled();
  });

  it("uploads file and returns public URL when valid", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);
    mockFns.validateUploadFile.mockReturnValue({
      ok: true,
      safeBaseName: "logo",
      extension: "png",
    });
    mockFns.convertAndSaveImage.mockResolvedValue(
      "public/uploads/landing-logo/logo_123_abc.webp",
    );
    const file = new File(["x"], "logo.png", { type: "image/png" });

    const res = await invoke(buildRequest(file), buildCtx(true));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.url).toBe("/uploads/landing-logo/logo_123_abc.webp");
    expect(mockFns.convertAndSaveImage).toHaveBeenCalledWith(
      file,
      "public/uploads/landing-logo",
      expect.stringContaining("logo_"),
      "logos",
    );
  });

  it("uses landing-logo folder for validation", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);
    mockFns.validateUploadFile.mockReturnValue({
      ok: true,
      safeBaseName: "logo",
      extension: "png",
    });
    mockFns.convertAndSaveImage.mockResolvedValue(
      "public/uploads/landing-logo/x.webp",
    );
    const file = new File(["x"], "logo.png", { type: "image/png" });
    await invoke(buildRequest(file), buildCtx(true));

    expect(mockFns.validateUploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ folder: "landing-logo" }),
    );
  });

  it("returns 500 when upload throws", async () => {
    mockFns.isSuperAdmin.mockReturnValue(true);
    mockFns.validateUploadFile.mockReturnValue({
      ok: true,
      safeBaseName: "logo",
      extension: "png",
    });
    mockFns.convertAndSaveImage.mockRejectedValue(new Error("disk full"));
    const file = new File(["x"], "logo.png", { type: "image/png" });

    const res = await invoke(buildRequest(file), buildCtx(true));
    expect(res.status).toBe(500);
  });
});
