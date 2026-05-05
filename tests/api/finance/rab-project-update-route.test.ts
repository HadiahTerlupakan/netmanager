import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { prismaMock } from "@/tests/setup";

const { mockHasPermission, mockIsSuperAdmin, mockUpdateProject } = vi.hoisted(
  () => ({
    mockHasPermission: vi.fn(),
    mockIsSuperAdmin: vi.fn(),
    mockUpdateProject: vi.fn(),
  }),
);

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/modules/finance", async () => {
  const { z } = await import("zod");

  return {
    isRouteServiceError: (
      error: unknown,
    ): error is { status: number; message: string } =>
      error instanceof Error && "status" in error,
    rabProjectUpdateSchema: z
      .object({
        status: z.enum(["DRAFT", "APPROVED"]).optional(),
        opexBufferFundingMode: z.string().optional(),
        opexBufferInvestorPercent: z.number().optional(),
        opexBufferCompanyPercent: z.number().optional(),
        targetBasis: z.string().optional(),
        targetHomepass: z.number().optional(),
        targetTakeUpRatePercent: z.number().optional(),
        targetSubscribers: z.number().optional(),
        projectedRevenue: z.number().optional(),
      })
      .superRefine((value, ctx) => {
        if (
          value.opexBufferFundingMode === "SHARED_PERCENTAGE" &&
          (value.opexBufferInvestorPercent ?? 0) +
            (value.opexBufferCompanyPercent ?? 0) !==
            100
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Total persentase harus 100",
          });
        }

        if (value.status === "APPROVED") {
          ctx.addIssue({
            code: "custom",
            message: "Perubahan approval harus melalui endpoint approval",
          });
        }
      }),
    RabProjectRouteService: class MockRabProjectRouteService {
      updateProject = mockUpdateProject;
    },
  };
});

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
      try {
        return await handler(request, {
          params: (await params) ?? {},
          session: { user: { id: "user-1" } },
          validated: options.schema ? options.schema.parse(body) : body,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            { error: error.issues[0]?.message || "Invalid request" },
            { status: 400 },
          );
        }
        throw error;
      }
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

  it("rejects inconsistent shared OPEX buffer percentage", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/finance/rab-projects/rab-1", {
        method: "PATCH",
        body: JSON.stringify({
          opexBufferFundingMode: "SHARED_PERCENTAGE",
          opexBufferInvestorPercent: 60,
          opexBufferCompanyPercent: 30,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rab-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("persentase");
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });

  it("forwards homepass target fields to the repository", async () => {
    mockUpdateProject.mockResolvedValue({
      id: "rab-1",
      status: "DRAFT",
      projectedRevenue: 30_000_000,
      projectedOpex: 0,
      arpu: 150_000,
      contingencyAmount: 0,
      opexBufferInvestorFixedAmount: 0,
      items: [],
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/finance/rab-projects/rab-1", {
        method: "PATCH",
        body: JSON.stringify({
          targetBasis: "HOMEPASS",
          targetHomepass: 500,
          targetTakeUpRatePercent: 40,
          targetSubscribers: 200,
          projectedRevenue: 30_000_000,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rab-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(
      "rab-1",
      expect.objectContaining({
        targetBasis: "HOMEPASS",
        targetHomepass: 500,
        targetTakeUpRatePercent: 40,
        targetSubscribers: 200,
        projectedRevenue: 30_000_000n,
      }),
    );
  });

  it("does not allow generic update permission to approve a RAB", async () => {
    mockUpdateProject.mockResolvedValue({
      id: "rab-1",
      status: "APPROVED",
      projectedRevenue: 0,
      projectedOpex: 0,
      arpu: null,
      contingencyAmount: 0,
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
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });
});
