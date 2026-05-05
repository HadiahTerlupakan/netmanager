import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";

const { mockCreateRabProject, mockHasPermission, mockIsSuperAdmin } =
  vi.hoisted(() => ({
    mockCreateRabProject: vi.fn(),
    mockHasPermission: vi.fn(),
    mockIsSuperAdmin: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/modules/finance", () => ({
  FinanceService: vi.fn(function FinanceService() {
    return {
      createRabProject: mockCreateRabProject,
    };
  }),
  rabProjectCreateSchema: z.record(z.string(), z.unknown()),
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
    async (request: NextRequest) => {
      const body = request.body ? await request.clone().json() : undefined;
      try {
        return await handler(request, {
          params: {},
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
  apiSuccess: (data: unknown, options?: { status?: number }) =>
    NextResponse.json(
      { success: true, data },
      { status: options?.status || 200 },
    ),
  ApiErrors: {
    forbidden: (message: string) =>
      NextResponse.json({ error: message }, { status: 403 }),
    badRequest: (message: string) =>
      NextResponse.json({ error: message }, { status: 400 }),
  },
}));

import { POST } from "@/app/api/finance/rab-projects/route";

describe("rab project create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockIsSuperAdmin.mockReturnValue(false);
  });

  it("menerima payload target homepass dari form RAB", async () => {
    mockCreateRabProject.mockResolvedValue({
      id: "rab-1",
      targetBasis: "HOMEPASS",
      targetHomepass: 500,
      targetTakeUpRatePercent: 40,
      targetSubscribers: 200,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/finance/rab-projects", {
        method: "POST",
        body: JSON.stringify({
          name: "RAB Homepass",
          description: "",
          status: "DRAFT",
          mixRadiusGroupId: null,
          mixRadiusInvestorSiteId: null,
          siteId: null,
          projectedRevenue: 30_000_000,
          projectedOpex: 5_000_000,
          targetBasis: "HOMEPASS",
          targetHomepass: 500,
          targetTakeUpRatePercent: 40,
          targetSubscribers: 200,
          arpu: 150_000,
          paymentType: "PREPAID",
          growthType: "LINEAR",
          growthSettings: { subscribersPerMonth: 20 },
          startDate: undefined,
          investmentDurationMonths: 12,
          investmentRecoveryType: "PERCENTAGE",
          investmentRecoveryValue: 50,
          investorProfitSharePercent: 50,
          nplTolerancePercent: 0,
          contingencyPercent: 0,
          contingencyAmount: 0,
          opexBufferFundingMode: "INVESTOR",
          opexBufferInvestorPercent: 100,
          opexBufferCompanyPercent: 0,
          opexBufferInvestorFixedAmount: 0,
          opexBufferSafetyPercent: 0,
          hasDisbursementPlan: false,
          investorIds: [],
          wbsGroups: [],
          items: [
            {
              name: "Kabel FO",
              description: "",
              quantity: 1,
              unitPrice: 1_000_000,
              category: "CABLE",
              expenseType: "CAPEX",
              expenseCategoryId: undefined,
              wbsGroupId: undefined,
              disbursements: [],
            },
          ],
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(mockCreateRabProject).toHaveBeenCalledWith(
      expect.objectContaining({
        targetBasis: "HOMEPASS",
        targetHomepass: 500,
        targetTakeUpRatePercent: 40,
        targetSubscribers: 200,
        arpu: 150_000n,
        projectedRevenue: 30_000_000n,
      }),
      "user-1",
    );
  });
});
