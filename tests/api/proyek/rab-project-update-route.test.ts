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

vi.mock("@/lib/api/route-service-error", () => ({
  isRouteServiceError: (
    error: unknown,
  ): error is { status: number; message: string } =>
    error instanceof Error && "status" in error,
}));

vi.mock("@/modules/proyek", () => ({
  RabProjectRouteService: class MockRabProjectRouteService {
    updateProject = mockUpdateProject;
  },
}));

// Route mengambil schema lewat `@/lib/validations/rab-project`, yang meneruskan
// ke `@/modules/proyek`. Karena index proyek dimock di atas, schema diarahkan
// langsung ke validator aslinya supaya coercion bigint tetap diuji.
vi.mock("@/lib/validations/rab-project", async () => ({
  rabProjectUpdateSchema: (
    await import("@/modules/proyek/validators/rabProjectSchemas")
  ).rabProjectUpdateSchema,
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

import { PATCH } from "@/app/api/proyek/[id]/route";

describe("rab project update route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockIsSuperAdmin.mockReturnValue(false);
  });

  it("rejects inconsistent shared OPEX buffer percentage", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/proyek/rab-1", {
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
      new NextRequest("http://localhost/api/proyek/rab-1", {
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
      new NextRequest("http://localhost/api/proyek/rab-1", {
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
