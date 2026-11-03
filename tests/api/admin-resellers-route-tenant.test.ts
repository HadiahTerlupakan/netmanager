import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";

const mockFns = vi.hoisted(() => ({
  listResellers: vi.fn(),
  createReseller: vi.fn(),
  listOutlets: vi.fn(),
  upsertPackagePrice: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // Body handler dijalankan langsung supaya error yang dilempar route
    // (bukan respons yang sudah dipetakan) bisa diperiksa.
    createHandler: vi.fn((_options, handler) => handler),
  };
});

vi.mock("@/modules/reseller", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getResellerService: () => ({
      listResellers: mockFns.listResellers,
      createReseller: mockFns.createReseller,
    }),
    getResellerOutletService: () => ({ listOutlets: mockFns.listOutlets }),
    getResellerPricingService: () => ({
      upsertPackagePrice: mockFns.upsertPackagePrice,
    }),
  };
});

import {
  GET as listResellers,
  POST as createReseller,
} from "@/app/api/admin/resellers/route";
import { GET as listOutlets } from "@/app/api/admin/resellers/[id]/outlets/route";
import { POST as upsertPackagePrice } from "@/app/api/admin/resellers/[id]/package-prices/route";

type RouteBody = (req: NextRequest, ctx: unknown) => Promise<Response>;

const TENANTLESS_SESSION = {
  user: { id: "root", tenantId: null as string | null },
};
const TENANT_SESSION = { user: { id: "admin", tenantId: "tenant-1" } };
const REQUEST = new NextRequest("http://localhost/api/admin/resellers");

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  return run().then(
    (): unknown => null,
    (caught: unknown) => caught,
  );
}

describe("admin reseller routes — tenant sesi wajib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.listResellers.mockResolvedValue({ items: [], total: 0 });
  });

  it.each([
    [
      "GET list",
      () =>
        (listResellers as unknown as RouteBody)(REQUEST, {
          session: TENANTLESS_SESSION,
          query: {},
          params: {},
        }),
    ],
    [
      "POST create",
      () =>
        (createReseller as unknown as RouteBody)(REQUEST, {
          session: TENANTLESS_SESSION,
          validated: { code: "R", name: "A" },
          params: {},
        }),
    ],
    [
      "GET outlets",
      () =>
        (listOutlets as unknown as RouteBody)(REQUEST, {
          session: TENANTLESS_SESSION,
          params: { id: "r-1" },
        }),
    ],
    [
      "POST package price",
      () =>
        (upsertPackagePrice as unknown as RouteBody)(REQUEST, {
          session: TENANTLESS_SESSION,
          validated: { hargaPaketId: "p", price: 1 },
          params: { id: "r-1" },
        }),
    ],
  ])(
    "%s tanpa tenant ditolak 400 sebelum menyentuh service",
    async (_label, run) => {
      const error = await captureError(run);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 400,
        code: "TENANT_ID_REQUIRED",
      });
      expect(mockFns.listResellers).not.toHaveBeenCalled();
      expect(mockFns.createReseller).not.toHaveBeenCalled();
      expect(mockFns.listOutlets).not.toHaveBeenCalled();
      expect(mockFns.upsertPackagePrice).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/admin/resellers — query divalidasi Zod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.listResellers.mockResolvedValue({ items: [], total: 0 });
  });

  it.each([
    { page: "abc" },
    { limit: "abc" },
    { limit: "100000" },
    { page: "0" },
  ])("query %j melempar ZodError (400), bukan NaN ke Prisma", async (query) => {
    const error = await captureError(() =>
      (listResellers as unknown as RouteBody)(REQUEST, {
        session: TENANT_SESSION,
        query,
        params: {},
      }),
    );

    expect(error).toBeInstanceOf(ZodError);
    expect(mockFns.listResellers).not.toHaveBeenCalled();
  });

  it("meneruskan search dan status ke service", async () => {
    const response = await (listResellers as unknown as RouteBody)(REQUEST, {
      session: TENANT_SESSION,
      query: { page: "2", limit: "50", search: "budi", status: "ACTIVE" },
      params: {},
    });

    expect(response.status).toBe(200);
    expect(mockFns.listResellers).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      page: 2,
      limit: 50,
      search: "budi",
      status: "ACTIVE",
    });
  });
});

describe("admin reseller routes — tanpa pemetaan error lewat substring", () => {
  it.each([
    "app/api/admin/resellers/route.ts",
    "app/api/admin/resellers/[id]/route.ts",
    "app/api/admin/resellers/[id]/outlets/route.ts",
    "app/api/admin/resellers/[id]/outlets/[outletId]/route.ts",
    "app/api/admin/resellers/[id]/package-prices/route.ts",
  ])(
    "%s memakai requireSessionTenantId dan tidak menebak status dari pesan",
    (file) => {
      const source = readFileSync(file, "utf8");

      expect(source).toContain("requireSessionTenantId");
      expect(source).not.toMatch(/function getTenantId/);
      expect(source).not.toMatch(/message\.includes\(/);
    },
  );
});
