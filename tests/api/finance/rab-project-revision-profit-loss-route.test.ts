import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";

const { mockHasPermission, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
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
      _options: unknown,
      handler: (
        req: NextRequest,
        ctx: {
          params: Record<string, string>;
          session: { user: { id: string } };
        },
      ) => Promise<Response>,
    ) =>
    async (
      request: NextRequest,
      { params }: { params?: Promise<Record<string, string>> },
    ) =>
      handler(request, {
        params: (await params) ?? {},
        session: { user: { id: "user-1" } },
      }),
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (message: string) =>
      NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message: string) =>
      NextResponse.json({ error: message }, { status: 404 }),
    badRequest: (message: string) =>
      NextResponse.json({ error: message }, { status: 400 }),
  },
}));

import { GET } from "@/app/api/finance/rab-projects/[id]/revision-profit-loss/route";

describe("rab project revision profit loss route", () => {
  beforeEach(() => {
    mockHasPermission.mockResolvedValue(true);
    mockIsSuperAdmin.mockReturnValue(false);
    Object.assign(prismaMock, {
      rabProject: prismaMock.rabProject,
      expense: prismaMock.expense,
    });
  });

  it("returns original, final, actual, and variance summaries for a project", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-1",
      projectedOpex: 20_000n,
      items: [
        {
          id: "item-1",
          name: "ODP",
          totalPrice: 100_000n,
          expenseType: "CAPEX",
        },
      ],
      finalApprovedRevisionId: "rev-2",
      finalApprovedRevision: {
        id: "rev-2",
        totalCapex: 120_000n,
        totalOpex: 25_000n,
        items: [
          {
            id: "rev-item-1",
            rabItemId: "item-1",
            name: "ODP",
            totalPrice: 120_000n,
            quantity: 2,
            unitPrice: 60_000n,
            expenseType: "CAPEX",
          },
        ],
      },
    });

    prismaMock.expense.findMany.mockResolvedValue([
      {
        id: "exp-1",
        amount: 110_000n,
        category: "CAPEX",
        rabItemId: "item-1",
        description: "Vendor invoice",
      },
      {
        id: "exp-2",
        amount: 20_000n,
        category: "OPEX",
        rabItemId: null,
        description: "Transport",
      },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/revision-profit-loss",
      ),
      {
        params: Promise.resolve({ id: "rab-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.originalSummary.total).toBe("120000");
    expect(body.data.finalRevisionSummary.total).toBe("145000");
    expect(body.data.actualSummary.total).toBe("130000");
    expect(body.data.varianceSummary.netLabel).toBe("UNTUNG");
    expect(body.data.itemVariances[0]).toEqual(
      expect.objectContaining({
        rabItemId: "item-1",
        finalTotal: "120000",
        actualTotal: "110000",
      }),
    );
    expect(body.data.unmappedRealization).toBe("20000");
  });
});
