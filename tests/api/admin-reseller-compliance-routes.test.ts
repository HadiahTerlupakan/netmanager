import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlerOptions: [] as Array<Record<string, unknown>>,
  getResellerWithCompliance: vi.fn(),
  updateReseller: vi.fn(),
  getComplianceSetting: vi.fn(),
  updateComplianceSetting: vi.fn(),
  listPackagePrices: vi.fn(),
  upsertPackagePrice: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      mocks.handlerOptions.push(options);
      return handler;
    }),
  };
});

vi.mock("@/modules/reseller", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getResellerService: () => ({ updateReseller: mocks.updateReseller }),
    getResellerComplianceService: () => ({
      getResellerWithCompliance: mocks.getResellerWithCompliance,
      getComplianceSetting: mocks.getComplianceSetting,
      updateComplianceSetting: mocks.updateComplianceSetting,
    }),
    getResellerPricingService: () => ({
      listPackagePrices: mocks.listPackagePrices,
      upsertPackagePrice: mocks.upsertPackagePrice,
    }),
  };
});

import {
  GET as getReseller,
  PATCH as patchReseller,
} from "@/app/api/admin/resellers/[id]/route";
import {
  DELETE as deletePrice,
  GET as listPrices,
  PATCH as patchPrice,
  POST as createPrice,
} from "@/app/api/admin/resellers/[id]/package-prices/route";
import {
  GET as getSetting,
  PUT as putSetting,
} from "@/app/api/admin/resellers/compliance-setting/route";

type RouteBody = (req: NextRequest, ctx: unknown) => Promise<Response>;
const call = (route: unknown, ctx: unknown) =>
  (route as RouteBody)(new NextRequest("http://localhost/api"), ctx);
const SESSION = { user: { id: "admin-1", tenantId: "tenant-1" } };

describe("GET/PATCH /api/admin/resellers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detail memuat kepatuhan reseller", async () => {
    mocks.getResellerWithCompliance.mockResolvedValueOnce({
      id: "r1",
      compliance: { isCompliant: false },
    });

    const response = await call(getReseller, {
      session: SESSION,
      params: { id: "r1" },
    });

    expect(response.status).toBe(200);
    expect(mocks.getResellerWithCompliance).toHaveBeenCalledWith(
      "tenant-1",
      "r1",
    );
    expect((await response.json()).data.compliance).toEqual({
      isCompliant: false,
    });
  });

  it("detail 404 bila reseller tidak ada", async () => {
    mocks.getResellerWithCompliance.mockResolvedValueOnce(null);

    const response = await call(getReseller, {
      session: SESSION,
      params: { id: "x" },
    });

    expect(response.status).toBe(404);
  });

  it("PATCH meneruskan id admin sebagai pelaku perubahan status", async () => {
    mocks.updateReseller.mockResolvedValueOnce({ id: "r1" });
    const validated = { status: "SUSPENDED", statusReason: "Tunggakan" };

    await call(patchReseller, {
      session: SESSION,
      params: { id: "r1" },
      validated,
    });

    expect(mocks.updateReseller).toHaveBeenCalledWith(
      "tenant-1",
      "r1",
      validated,
      "admin-1",
    );
  });
});

describe("/api/admin/resellers/[id]/package-prices — hanya-baca", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET tetap mengembalikan data lama", async () => {
    mocks.listPackagePrices.mockResolvedValueOnce([{ id: "p1" }]);

    const response = await call(listPrices, {
      session: SESSION,
      params: { id: "r1" },
    });

    expect(response.status).toBe(200);
    expect(mocks.listPackagePrices).toHaveBeenCalledWith("tenant-1", "r1");
  });

  it.each([
    ["POST", createPrice],
    ["PATCH", patchPrice],
    ["DELETE", deletePrice],
  ])("%s dibalas 410 Gone", async (_method, route) => {
    const response = await call(route, {
      session: SESSION,
      params: { id: "r1" },
    });
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toMatch(/Harga khusus reseller sudah tidak dipakai/);
    expect(mocks.upsertPackagePrice).not.toHaveBeenCalled();
  });
});

describe("/api/admin/resellers/compliance-setting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET membaca pengaturan tenant sesi", async () => {
    mocks.getComplianceSetting.mockResolvedValueOnce({
      isComplianceRequired: false,
    });

    const response = await call(getSetting, { session: SESSION, params: {} });

    expect(mocks.getComplianceSetting).toHaveBeenCalledWith("tenant-1");
    expect((await response.json()).data).toEqual({
      isComplianceRequired: false,
    });
  });

  it("PUT menyimpan pengaturan tenant sesi", async () => {
    mocks.updateComplianceSetting.mockResolvedValueOnce({
      isComplianceRequired: true,
    });

    await call(putSetting, {
      session: SESSION,
      params: {},
      validated: { isComplianceRequired: true },
    });

    expect(mocks.updateComplianceSetting).toHaveBeenCalledWith(
      "tenant-1",
      true,
    );
  });

  it("PUT butuh izin pengaturan umum DAN reseller (bukan salah satu)", () => {
    // PUT adalah route terakhir yang diimpor di berkas ini.
    const putOptions = mocks.handlerOptions.at(-1);

    expect(putOptions).toMatchObject({
      permissionsAll: ["umum:update", "reseller:update"],
      feature: "reseller",
      schema: expect.anything(),
    });
    expect(putOptions).not.toHaveProperty("permissions");
  });

  it("GET cukup reseller:read", () => {
    expect(mocks.handlerOptions.at(-2)).toMatchObject({
      permissions: ["reseller:read"],
      feature: "reseller",
    });
  });
});
