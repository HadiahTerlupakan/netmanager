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

import { GET, POST } from "@/app/api/finance/rab-projects/[id]/revisions/route";

describe("rab project revisions route", () => {
  beforeEach(() => {
    mockHasPermission.mockResolvedValue(true);
    mockIsSuperAdmin.mockReturnValue(false);
    Object.assign(prismaMock, {
      rabProject: prismaMock.rabProject,
      rabRevision: prismaMock.rabRevision,
    });
  });

  it("creates revision 1 by snapshotting the current project and items", async () => {
    prismaMock.rabProject.findUnique.mockResolvedValue({
      id: "rab-1",
      projectedOpex: 25_000n,
      items: [
        {
          id: "item-1",
          name: "ODP",
          description: "Fiber item",
          quantity: 2,
          unitPrice: 50_000n,
          totalPrice: 100_000n,
          category: "HARDWARE",
          expenseType: "CAPEX",
          expenseCategoryId: null,
          wbsId: null,
        },
      ],
      revisions: [],
      finalApprovedRevision: null,
    });

    prismaMock.rabRevision.create.mockResolvedValue({
      id: "rev-1",
      rabProjectId: "rab-1",
      revisionNumber: 1,
      status: "DRAFT",
      reason: null,
      notes: null,
      createdById: "user-1",
      submittedById: null,
      submittedAt: null,
      approvedById: null,
      approvedAt: null,
      rejectedById: null,
      rejectedAt: null,
      totalCapex: 100_000n,
      totalOpex: 25_000n,
      createdAt: new Date("2026-03-13T00:00:00Z"),
      updatedAt: new Date("2026-03-13T00:00:00Z"),
      items: [
        {
          id: "rev-item-1",
          rabRevisionId: "rev-1",
          rabItemId: "item-1",
          name: "ODP",
          description: "Fiber item",
          quantity: 2,
          unitPrice: 50_000n,
          totalPrice: 100_000n,
          category: "HARDWARE",
          expenseType: "CAPEX",
          expenseCategoryId: null,
          wbsId: null,
          sortOrder: 0,
        },
      ],
      approvals: [],
    });

    const response = await POST(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/revisions",
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ id: "rab-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.rabRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rabProjectId: "rab-1",
          revisionNumber: 1,
          totalCapex: 100_000n,
          totalOpex: 25_000n,
          items: {
            create: [
              expect.objectContaining({
                rabItemId: "item-1",
                unitPrice: 50_000n,
                totalPrice: 100_000n,
              }),
            ],
          },
        }),
      }),
    );
  });

  it("lists revisions with bigint-safe serialization", async () => {
    prismaMock.rabRevision.findMany.mockResolvedValue([
      {
        id: "rev-1",
        rabProjectId: "rab-1",
        revisionNumber: 1,
        status: "APPROVED",
        reason: "Harga vendor naik",
        notes: null,
        createdById: "user-1",
        submittedById: "user-1",
        submittedAt: new Date("2026-03-13T00:00:00Z"),
        approvedById: "approver-1",
        approvedAt: new Date("2026-03-13T01:00:00Z"),
        rejectedById: null,
        rejectedAt: null,
        totalCapex: 150_000n,
        totalOpex: 30_000n,
        createdAt: new Date("2026-03-13T00:00:00Z"),
        updatedAt: new Date("2026-03-13T01:00:00Z"),
        items: [],
        approvals: [],
      },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/finance/rab-projects/rab-1/revisions",
      ),
      {
        params: Promise.resolve({ id: "rab-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        totalCapex: "150000",
        totalOpex: "30000",
      }),
    );
  });
});
