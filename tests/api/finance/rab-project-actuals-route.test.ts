import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";

const { mockHasPermission, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/lib/api", () => ({
  createHandler:
    (
      options: { schema?: { parse: (value: unknown) => unknown } },
      handler: (
        req: NextRequest,
        ctx: {
          params: Record<string, string>;
          session: { user: { id: string } };
          validated?: unknown;
        },
      ) => Promise<Response>,
    ) =>
    async (
      request: NextRequest,
      { params }: { params?: Promise<Record<string, string>> },
    ) => {
      const body = request.body ? await request.clone().json() : undefined;
      return handler(request, {
        params: (await params) ?? {},
        session: { user: { id: "user-1" } },
        validated: options.schema ? options.schema.parse(body) : body,
      });
    },
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (message: string) =>
      NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message: string) =>
      NextResponse.json({ error: message }, { status: 404 }),
  },
}));

import { POST } from "@/app/api/finance/rab-projects/[id]/actuals/route";

const payload = {
  month: 1,
  year: 2026,
  actualSubscribers: 12,
  actualRevenue: 120000,
};

describe("rab project actuals route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(false);
    Object.assign(prismaMock, {
      rabProject: prismaMock.rabProject,
      rabActualAchievement: prismaMock.rabActualAchievement,
    });
    prismaMock.rabProject.findUnique.mockResolvedValue({ id: "rab-1" });
    prismaMock.rabActualAchievement.upsert.mockResolvedValue({
      id: "actual-1",
      actualRevenue: 120000n,
      actualOpex: 0n,
      manualRecoveryInstallment: null,
      manualInvestorShare: null,
      manualCompanyShare: null,
      manualInvestorProfitSharePercent: null,
    });
  });

  it("requires update permission because actuals mutate an existing RAB", async () => {
    mockHasPermission.mockImplementation(
      async (permission: string) => permission === "expense:update",
    );

    const response = await POST(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/actuals",
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
        },
      ),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockHasPermission).toHaveBeenCalledWith("expense:update");
    expect(prismaMock.rabActualAchievement.upsert).toHaveBeenCalled();
  });

  it("rejects create-only users from mutating actuals", async () => {
    mockHasPermission.mockImplementation(
      async (permission: string) => permission === "expense:create",
    );

    const response = await POST(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/actuals",
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
        },
      ),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(403);
    expect(prismaMock.rabActualAchievement.upsert).not.toHaveBeenCalled();
  });
});
