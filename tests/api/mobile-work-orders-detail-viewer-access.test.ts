import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  service: null as null | object,
  findById: vi.fn(),
  loadScopeContext: vi.fn(),
  unclaimedGuard: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status || 500 },
    ),
  ApiErrors: {
    forbidden: (message = "Forbidden") =>
      NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message = "Not found") =>
      NextResponse.json({ error: message }, { status: 404 }),
  },
  ErrorCodes: { INTERNAL_ERROR: "INTERNAL_ERROR" },
}));

vi.mock(
  "@/modules/work-order/services/mobile-unclaimed-work-order-guard",
  () => ({ mobileUnclaimedWorkOrderGuard: mocks.unclaimedGuard }),
);

// Route memakai service asli; hanya repository & pemuat profil lingkup yang
// dipalsukan, jadi permission dari `ctx` benar-benar sampai ke guard pengamat.
// Service dibuat di luar factory: rantai impornya sendiri memuat
// `@/modules/work-order`, sehingga impor di dalam factory saling menunggu.
vi.mock("@/modules/work-order", () => ({
  getEmployeeWorkOrderQueryService: () => mocks.service,
}));

import { EmployeeWorkOrderQueryService } from "@/modules/work-order/services/EmployeeWorkOrderQueryService";
import { GET } from "@/app/api/mobile/work-orders/[id]/route";

const TENANT = "tenant-1";

type DetailHandler = (
  request: Request,
  ctx: {
    params: { id: string };
    permissions: string[];
    session: { user: Record<string, unknown> };
  },
) => Promise<Response>;

function callDetail(permissions: string[], user: Record<string, unknown> = {}) {
  return (GET as unknown as DetailHandler)(
    new Request("http://localhost/api/mobile/work-orders/wo-1"),
    {
      params: { id: "wo-1" },
      permissions,
      session: {
        user: {
          id: "admin-1",
          name: "Admin Jaksel",
          role: "admin",
          siteId: "site-jaksel",
          tenantId: TENANT,
          isSuperAdmin: false,
          ...user,
        },
      },
    },
  );
}

function pendingWorkOrderCariu(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    tenantId: TENANT,
    status: "PENDING",
    assignedToId: null as string | null,
    assignedMitraId: null as string | null,
    siteId: "site-cariu",
    departmentId: null as string | null,
    assignments: [] as never[],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.service = new EmployeeWorkOrderQueryService(
    { findById: mocks.findById } as never,
    mocks.loadScopeContext,
  );
  mocks.unclaimedGuard.mockReset().mockResolvedValue(false);
  mocks.findById.mockReset().mockResolvedValue(pendingWorkOrderCariu());
  mocks.loadScopeContext
    .mockReset()
    .mockImplementation(async (_user, permissions: string[]) => ({
      id: "admin-1",
      permissions,
      siteId: "site-jaksel",
      siteIds: ["site-jaksel"],
    }));
});

describe("GET /api/mobile/work-orders/[id] — viewerAccess", () => {
  it("admin workorders:read membuka WO PENDING site lain sebagai OBSERVER", async () => {
    const response = await callDetail([
      "m_work_order:read",
      "workorders:read",
      "workorders:verify",
    ]);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "wo-1", viewerAccess: "OBSERVER" });
  });

  it("teknisi pemegang mendapat PARTICIPANT", async () => {
    mocks.findById.mockResolvedValue(
      pendingWorkOrderCariu({ status: "IN_PROGRESS", assignedToId: "admin-1" }),
    );

    const body = await (await callDetail(["m_work_order:read"])).json();

    expect(body.data.viewerAccess).toBe("PARTICIPANT");
  });

  it("WO tersedia untuk diklaim mendapat CLAIMABLE", async () => {
    mocks.unclaimedGuard.mockResolvedValue(true);

    const body = await (await callDetail(["m_work_order:read"])).json();

    expect(body.data.viewerAccess).toBe("CLAIMABLE");
  });

  it("tanpa workorders:read tetap 403", async () => {
    const response = await callDetail(["m_work_order:read"]);

    expect(response.status).toBe(403);
  });

  it("workorders:site_only untuk site lain tetap 403", async () => {
    mocks.findById.mockResolvedValue(
      pendingWorkOrderCariu({ status: "IN_PROGRESS" }),
    );

    const response = await callDetail([
      "workorders:read",
      "workorders:site_only",
    ]);

    expect(response.status).toBe(403);
  });

  it("tenant lain tetap 403", async () => {
    mocks.findById.mockResolvedValue(
      pendingWorkOrderCariu({ tenantId: "tenant-lain" }),
    );

    const response = await callDetail(["*"]);

    expect(response.status).toBe(403);
  });
});
