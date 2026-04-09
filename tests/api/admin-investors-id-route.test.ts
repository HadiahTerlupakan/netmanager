import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getInvestorById: vi.fn(),
  updateInvestorById: vi.fn(),
  toggleInvestorActive: vi.fn(),
  deleteInvestorById: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      const wrappedHandler = async (
        req: NextRequest & { clone: () => NextRequest },
        ctx: { validated?: unknown },
      ) => {
        if (options.schema && req.json) {
          try {
            const body = await req.clone().json();
            ctx.validated = options.schema.parse(body);
          } catch (_e) {
            // keep the test helper lightweight
          }
        }
        return handler(req, ctx);
      };
      (wrappedHandler as unknown as { options: unknown }).options = options;
      return wrappedHandler;
    }),
    apiSuccess: vi.fn((data, options) =>
      NextResponse.json({ success: true, data }, options),
    ),
    ApiErrors: {
      badRequest: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 400 }),
      ),
      notFound: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 404 }),
      ),
    },
  };
});

vi.mock("@/modules/finance/services/InvestorAdminService", () => ({
  getInvestorById: mockFns.getInvestorById,
  updateInvestorById: mockFns.updateInvestorById,
  toggleInvestorActive: mockFns.toggleInvestorActive,
  deleteInvestorById: mockFns.deleteInvestorById,
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed_password"),
}));

import { DELETE, GET, PATCH, PUT } from "@/app/api/admin/investors/[id]/route";

describe("Admin investor [id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET delegates to the finance investor service and returns a safe investor", async () => {
    mockFns.getInvestorById.mockResolvedValue({
      id: "inv-1",
      username: "investor1",
      namaLengkap: "Investor One",
      perusahaan: "PT Example",
      email: "investor@example.com",
      noTelp: "08123456789",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const request = new NextRequest(
      "http://localhost/api/admin/investors/inv-1",
    );
    const response = await (
      GET as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<NextResponse>
    )(request, { params: { id: "inv-1" } });
    const json = (await response.json()) as {
      success: boolean;
      data: { username: string; passwordHash?: string };
    };

    expect(mockFns.getInvestorById).toHaveBeenCalledWith("inv-1");
    expect(json.success).toBe(true);
    expect(json.data.username).toBe("investor1");
    expect(json.data).not.toHaveProperty("passwordHash");
  });

  it("PUT validates input, delegates update work, and returns a safe investor", async () => {
    mockFns.updateInvestorById.mockResolvedValue({
      success: true,
      data: {
        id: "inv-1",
        username: "updated-investor",
        namaLengkap: "Updated Investor",
        perusahaan: "PT Updated",
        email: "updated@example.com",
        noTelp: "08123456780",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    });

    const payload = {
      username: "updated-investor",
      password: "password123",
      namaLengkap: "Updated Investor",
      perusahaan: "PT Updated",
      email: "updated@example.com",
      noTelp: "08123456780",
    };

    const request = new NextRequest(
      "http://localhost/api/admin/investors/inv-1",
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    const response = await (
      PUT as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<NextResponse>
    )(request, { params: { id: "inv-1" } });
    const json = (await response.json()) as {
      success: boolean;
      data: { username: string; passwordHash?: string };
    };

    expect(mockFns.updateInvestorById).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({
        username: "updated-investor",
        password: "password123",
        namaLengkap: "Updated Investor",
        perusahaan: "PT Updated",
        email: "updated@example.com",
        noTelp: "08123456780",
      }),
    );
    expect(json.success).toBe(true);
    expect(json.data.username).toBe("updated-investor");
    expect(json.data).not.toHaveProperty("passwordHash");
  });

  it("PATCH delegates active-state updates to the finance investor service", async () => {
    mockFns.toggleInvestorActive.mockResolvedValue({
      success: true,
      data: {
        id: "inv-1",
        isActive: false,
      },
    });

    const request = new NextRequest(
      "http://localhost/api/admin/investors/inv-1",
      {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      },
    );

    const response = await (
      PATCH as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<NextResponse>
    )(request, { params: { id: "inv-1" } });
    const json = (await response.json()) as {
      success: boolean;
      data: { isActive: boolean };
    };

    expect(mockFns.toggleInvestorActive).toHaveBeenCalledWith("inv-1", false);
    expect(json.success).toBe(true);
    expect(json.data.isActive).toBe(false);
  });

  it("DELETE delegates deletion checks to the finance investor service", async () => {
    mockFns.deleteInvestorById.mockResolvedValue({
      success: true,
      data: { username: "investor1" },
    });

    const request = new NextRequest(
      "http://localhost/api/admin/investors/inv-1",
      {
        method: "DELETE",
      },
    );

    const response = await (
      DELETE as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<NextResponse>
    )(request, { params: { id: "inv-1" } });
    const json = (await response.json()) as {
      success: boolean;
      data: { message: string };
    };

    expect(mockFns.deleteInvestorById).toHaveBeenCalledWith("inv-1");
    expect(json.success).toBe(true);
    expect(json.data.message).toBe("Investor berhasil dihapus");
  });

  it("DELETE returns bad request when service rejects deletion because relations still exist", async () => {
    mockFns.deleteInvestorById.mockResolvedValue({
      success: false,
      error:
        "Gagal menghapus investor karena masih terkait dengan Proyek RAB atau riwayat Payout. Silakan Nonaktifkan akun saja.",
      code: "BAD_REQUEST",
    });

    const request = new NextRequest(
      "http://localhost/api/admin/investors/inv-1",
      {
        method: "DELETE",
      },
    );

    const response = await (
      DELETE as unknown as (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<NextResponse>
    )(request, { params: { id: "inv-1" } });
    const json = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain(
      "Gagal menghapus investor karena masih terkait",
    );
  });
});
