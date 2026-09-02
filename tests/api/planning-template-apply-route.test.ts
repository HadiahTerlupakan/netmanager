import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  applyTemplate: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logAuditActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/planning", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/planning")>(
      "@/modules/planning",
    );

  return {
    ...actual,
    planningTemplateService: { applyTemplate: mockFns.applyTemplate },
  };
});

import { POST } from "@/app/api/planning/templates/[templateId]/apply/route";

const body = (over: Record<string, unknown> = {}) => ({
  title: "Ekspansi FO Cipinang",
  area: "Cipinang, Jakarta Timur",
  estimatedUnits: 250,
  ...over,
});

const call = (payload: unknown) =>
  POST(
    new NextRequest("http://localhost/api/planning/templates/tpl-1/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ templateId: "tpl-1" }) },
  );

describe("POST /api/planning/templates/[templateId]/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "pm@radpro.id",
        role: "Field Manager",
        tenantId: "tenant-1",
      },
    });
    mockFns.getUserPermissions.mockResolvedValue(["planning:create"]);
    mockFns.applyTemplate.mockResolvedValue({
      id: "planning-1",
      title: "Ekspansi FO Cipinang",
      items: [],
    });
  });

  /**
   * Form "Terapkan Template" menandai Estimasi Unit sebagai wajib, tapi route
   * mengirim estimatedUnits: 0 ke service dengan komentar bahwa nilainya "akan
   * dihitung dari items" -- padahal tidak ada yang menghitungnya. Isian
   * pengguna hilang tanpa jejak.
   */
  it("meneruskan estimatedUnits dari pemohon, bukan nol", async () => {
    const response = await call(body({ estimatedUnits: 250 }));

    expect(response.status).toBe(201);
    expect(mockFns.applyTemplate).toHaveBeenCalledWith(
      "tpl-1",
      expect.objectContaining({ estimatedUnits: 250 }),
      "tenant-1",
      "user-1",
    );
  });

  it("menolak permintaan tanpa estimatedUnits", async () => {
    const payload = body();
    delete (payload as Record<string, unknown>).estimatedUnits;

    const response = await call(payload);

    expect(response.status).toBe(400);
    expect(mockFns.applyTemplate).not.toHaveBeenCalled();
  });

  it("menolak estimatedUnits nol atau negatif", async () => {
    for (const value of [0, -5]) {
      mockFns.applyTemplate.mockClear();

      const response = await call(body({ estimatedUnits: value }));

      expect(response.status).toBe(400);
      expect(mockFns.applyTemplate).not.toHaveBeenCalled();
    }
  });

  it("menolak user tanpa permission planning:create", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["planning:read"]);

    const response = await call(body());

    expect(response.status).toBe(403);
    expect(mockFns.applyTemplate).not.toHaveBeenCalled();
  });
});
