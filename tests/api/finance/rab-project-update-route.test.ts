import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/tests/setup";

const { mockHasPermission, mockIsSuperAdmin, mockUpdateProjectWithRelations } =
  vi.hoisted(() => ({
    mockHasPermission: vi.fn(),
    mockIsSuperAdmin: vi.fn(),
    mockUpdateProjectWithRelations: vi.fn(),
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

vi.mock("@/modules/finance", () => ({
  RabProjectRepository: vi.fn(function RabProjectRepository() {
    return {
      updateProjectWithRelations: mockUpdateProjectWithRelations,
    };
  }),
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
    badRequest: (message: string) =>
      NextResponse.json({ error: message }, { status: 400 }),
  },
}));

import { PATCH } from "@/app/api/finance/rab-projects/[id]/route";

describe("rab project update route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockIsSuperAdmin.mockReturnValue(false);
  });

  it("does not allow generic update permission to approve a RAB", async () => {
    mockUpdateProjectWithRelations.mockResolvedValue({
      id: "rab-1",
      status: "APPROVED",
      projectedRevenue: 0n,
      projectedOpex: 0n,
      arpu: null,
      contingencyAmount: 0n,
      items: [],
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/finance/rab-projects/rab-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rab-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("approval");
    expect(mockUpdateProjectWithRelations).not.toHaveBeenCalled();
  });
});
