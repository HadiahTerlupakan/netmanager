import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Gerbang dan validasi route komisi/settlement reseller, lewat `createHandler`
 * yang asli. Service komisi dipalsukan; validator dan DTO memakai yang asli.
 */

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  service: {
    createSettlement: vi.fn(),
    listCommissions: vi.fn(),
    listSettlements: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/modules/feature-flags", () => ({
  getFeatureFlagService: () => ({ isEnabled: async () => true }),
}));
vi.mock("@/modules/reseller", async () => {
  const validators =
    await import("@/modules/reseller/validators/reseller-commission");
  const dto = await import("@/modules/reseller/dto/commission.dto");
  return {
    ...validators,
    ...dto,
    getResellerCommissionService: () => mocks.service,
  };
});

import { POST as postSettlement } from "@/app/api/admin/resellers/[id]/settlements/route";
import { GET as getCommissions } from "@/app/api/admin/resellers/[id]/commissions/route";

const ROUTE_CONTEXT = { params: Promise.resolve({ id: "reseller-1" }) };

const SETTLEMENT = {
  id: "settlement-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  periodStart: new Date("2026-07-01T00:00:00.000Z"),
  periodEnd: new Date("2026-07-31T23:59:59.999Z"),
  totalAmount: 50000,
  commissionCount: 2,
  status: "PENDING",
  notes: null as string | null,
  createdAt: new Date("2026-07-31T00:00:00.000Z"),
  updatedAt: new Date("2026-07-31T00:00:00.000Z"),
  approvedAt: null as Date | null,
  paidAt: null as Date | null,
  deletedAt: null as Date | null,
};

function signInWith(permissions: string[]): void {
  mocks.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "a@example.com",
      tenantId: "tenant-1",
      isSuperAdmin: false,
      permissions,
    },
  });
}

function settlementRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    "http://localhost/api/admin/resellers/reseller-1/settlements",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function commissionsRequest(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/resellers/reseller-1/commissions${query}`,
  );
}

const JULY = {
  periodStart: "2026-07-01T00:00:00.000Z",
  periodEnd: "2026-07-31T23:59:59.999Z",
};

describe("POST /api/admin/resellers/[id]/settlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.service.createSettlement.mockResolvedValue(SETTLEMENT);
  });

  // Audit #30: settlement adalah aksi keuangan, bukan sekadar edit reseller.
  it("rejects 403 when the caller only holds reseller:update", async () => {
    signInWith(["reseller:update"]);

    const response = await postSettlement(
      settlementRequest(JULY),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(403);
    expect(mocks.service.createSettlement).not.toHaveBeenCalled();
  });

  it("settles when the caller also holds transactions:create", async () => {
    signInWith(["reseller:update", "transactions:create"]);

    const response = await postSettlement(
      settlementRequest(JULY),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(201);
    expect(mocks.service.createSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        resellerId: "reseller-1",
      }),
    );
  });

  // Audit #38: periode terbalik ditolak validasi.
  it("rejects 400 when periodStart is after periodEnd", async () => {
    signInWith(["reseller:update", "transactions:create"]);

    const response = await postSettlement(
      settlementRequest({
        periodStart: JULY.periodEnd,
        periodEnd: JULY.periodStart,
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(mocks.service.createSettlement).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/resellers/[id]/commissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWith(["reseller:read"]);
    mocks.service.listCommissions.mockResolvedValue({ items: [], total: 0 });
  });

  // Audit #19: query list divalidasi listResellerCommissionSchema.
  it.each([["?limit=100000"], ["?page=abc"], ["?period=juli"]])(
    "rejects 400 for invalid query %s",
    async (query) => {
      const response = await getCommissions(
        commissionsRequest(query),
        ROUTE_CONTEXT,
      );

      expect(response.status).toBe(400);
      expect(mocks.service.listCommissions).not.toHaveBeenCalled();
    },
  );

  it("applies default pagination", async () => {
    const response = await getCommissions(
      commissionsRequest(""),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(mocks.service.listCommissions).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      period: undefined,
      skip: 0,
      take: 20,
    });
  });
});
